import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/guard';
import { TopicRepository } from '../db/repositories/topic.repository';
import { SessionRepository } from '../db/repositories/session.repository';
import { AIService } from '../ai/service';
import {
  SocraticStateMachine,
  gradeUserAnswer,
  buildSocraticSystemPrompt,
  calculateSM2,
  evaluateEnglish,
  SessionLevel,
  SessionMode,
} from '@mindset/learning';
import type { Topic } from '@mindset/shared';

const CreateSessionSchema = z.object({
  topicId: z.string().min(1),
  level: z.enum(['foundation', 'working', 'advanced']).default('working'),
  sessionMode: z.enum(['standard', 'quick']).default('standard'),
});

const SubmitAnswerSchema = z.object({
  answer: z.string().min(1, 'Answer cannot be empty'),
});

// Cache active state machines in memory
const activeSessions = new Map<string, SocraticStateMachine>();

function getOrRestoreStateMachine(
  sessionId: string,
  sessionRecord: any,
  topic: Topic,
  steps: any[]
): SocraticStateMachine {
  let sm = activeSessions.get(sessionId);
  if (!sm) {
    sm = new SocraticStateMachine({
      sessionId,
      topic,
      level: sessionRecord.level as SessionLevel,
      sessionMode: sessionRecord.sessionMode as SessionMode,
    });

    // Replay recorded steps
    for (const step of steps) {
      if (step.qualityScore) {
        sm.submitAnswer(step.userAnswer || '', step.gradeResult || {
          qualityScore: step.qualityScore,
          coveredKeyPoints: [],
          missingKeyPoints: [],
          feedback: '',
          suggestedFollowup: '',
          isPass: step.qualityScore >= 3,
        });
      }
    }
    activeSessions.set(sessionId, sm);
  }
  return sm;
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topicRepo = (app as any).topicRepo as TopicRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRepo = (app as any).sessionRepo as SessionRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiService = (app as any).aiService as AIService;

  // POST /api/v1/sessions — Start new learning session
  app.post('/', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateSessionSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid session payload', details: parseResult.error.flatten() },
      });
    }

    const { topicId, level, sessionMode } = parseResult.data;
    const topic = await topicRepo.getTopicById(topicId);
    if (!topic || !topic.isActive) {
      return reply.status(404).send({
        error: { code: 'TOPIC_NOT_FOUND', message: `Topic ${topicId} not found or inactive` },
      });
    }

    if (topic.referenceStatus === 'unauthored') {
      return reply.status(400).send({
        error: {
          code: 'TOPIC_UNAUTHORED',
          message: `Topic ${topicId} has unauthored reference data and cannot be selected for graded sessions.`,
        },
      });
    }

    const session = await sessionRepo.createSession({
      topicId,
      level,
      sessionMode,
    });

    if (!session) {
      return reply.status(500).send({
        error: { code: 'SESSION_CREATE_FAILED', message: 'Failed to create session' },
      });
    }

    const sm = new SocraticStateMachine({
      sessionId: session.id,
      topic,
      level: level as SessionLevel,
      sessionMode: sessionMode as SessionMode,
    });
    activeSessions.set(session.id, sm);

    const stepData = sm.getCurrentStepData();
    const initialQuestion = stepData?.coachQuestion || 'Let us begin our system design discussion.';

    // Record initial coach question in messages
    await sessionRepo.addMessage({
      sessionId: session.id,
      role: 'coach',
      content: initialQuestion,
      stepNumber: sm.getCurrentStepNumber(),
    });

    return reply.status(201).send({
      session,
      currentStep: sm.getCurrentStepNumber(),
      hintsRemaining: sm.getHintsRemaining(),
      state: sm.getState(),
      initialQuestion,
    });
  });

  // GET /api/v1/sessions/:id — Retrieve full session details, transcript, and scores
  app.get('/:id', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const session = await sessionRepo.getSession(id);
    if (!session) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Session ${id} not found` },
      });
    }

    const topic = await topicRepo.getTopicById(session.topicId);
    const messagesList = await sessionRepo.getMessages(id);
    const stepsList = await sessionRepo.getSteps(id);
    const englishReport = await sessionRepo.getEnglishReport(id);

    return reply.send({
      session,
      topic,
      messages: messagesList,
      steps: stepsList,
      englishReport,
    });
  });

  // POST /api/v1/sessions/:id/answer — Submit answer with Server-Sent Events (SSE) streaming
  app.post('/:id/answer', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const session = await sessionRepo.getSession(id);
    if (!session) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Session ${id} not found` },
      });
    }

    const parseResult = SubmitAnswerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'answer string is required' },
      });
    }
    const userAnswer = parseResult.data.answer;

    const topic = await topicRepo.getTopicById(session.topicId);
    if (!topic) {
      return reply.status(404).send({ error: { code: 'TOPIC_NOT_FOUND', message: 'Topic not found' } });
    }

    const steps = await sessionRepo.getSteps(id);
    const sm = getOrRestoreStateMachine(id, session, topic, steps);
    const stepNumber = sm.getCurrentStepNumber();
    const stepData = sm.getCurrentStepData();

    if (!stepData) {
      return reply.status(400).send({ error: { code: 'INVALID_STEP', message: 'Step data not found' } });
    }

    // Set headers for Server-Sent Events (SSE)
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders?.();

    const sendSSE = (event: string, data: any) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // 1. Record user message in DB
      await sessionRepo.addMessage({
        sessionId: id,
        role: 'user',
        content: userAnswer,
        stepNumber,
      });

      // 2. Grade answer with pinned AI grader
      const router = aiService.getRouter();
      const { rubric, provenance } = await gradeUserAnswer(
        router,
        topic,
        stepData,
        session.level as SessionLevel,
        userAnswer
      );

      // 3. Update state machine
      const stepEval = sm.submitAnswer(userAnswer, rubric);

      // Send 'grade' SSE event
      sendSSE('grade', {
        stepNumber,
        qualityScore: stepEval.qualityScore,
        independenceScore: stepEval.independenceScore,
        compositeScore: stepEval.compositeScore,
        rubric: stepEval.rubric,
        isStepPass: stepEval.isStepPass,
        canAdvance: stepEval.canAdvance,
        provenance,
      });

      // 4. Stream Socratic Coach feedback / next question
      const coachSystemPrompt = buildSocraticSystemPrompt(topic, session.level as SessionLevel);
      const conversationMessages = await sessionRepo.getMessages(id);

      const llmMessages = [
        { role: 'system' as const, content: coachSystemPrompt },
        ...conversationMessages.slice(-6).map((m) => ({
          role: (m.role === 'coach' ? 'assistant' : m.role === 'user' ? 'user' : 'system') as
            | 'assistant'
            | 'user'
            | 'system',
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: `Evaluation:\nScore: ${rubric.qualityScore}/4.\nFeedback: ${rubric.feedback}\nSuggested Socratic follow-up: ${rubric.suggestedFollowup}`,
        },
      ];

      let coachResponseText = '';
      const stream = router.stream({ messages: llmMessages, temperature: 0.7 });

      for await (const chunk of stream) {
        if (chunk.delta) {
          coachResponseText += chunk.delta;
          sendSSE('token', { delta: chunk.delta });
        }
      }

      // If response text was empty, provide a clean default followup
      if (!coachResponseText.trim()) {
        coachResponseText = rubric.suggestedFollowup || rubric.feedback || 'Great point. How would you handle the storage layer?';
        sendSSE('token', { delta: coachResponseText });
      }

      // 5. Persist coach response in DB
      await sessionRepo.addMessage({
        sessionId: id,
        role: 'coach',
        content: coachResponseText,
        stepNumber,
        providerUsed: provenance.graderId,
      });

      // 6. Record step in database
      await sessionRepo.recordStep({
        sessionId: id,
        stepNumber,
        stepSlug: stepEval.stepSlug,
        attempts: sm.getAttempts(),
        hintsUsed: sm.getHintsUsed(),
        qualityScore: stepEval.qualityScore,
        independenceScore: stepEval.independenceScore,
        compositeScore: stepEval.compositeScore,
        gradeResult: stepEval.rubric,
        graderId: provenance.graderId,
        rubricVersion: provenance.rubricVersion,
        isFallbackGrade: provenance.isFallbackGrade,
        userAnswer,
        coachQuestion: stepData.coachQuestion,
        teachingResponse: coachResponseText,
        completedAt: stepEval.canAdvance ? new Date().toISOString() : undefined,
      });

      // 7. Check if session completed
      const isComplete = sm.isFinished();
      if (isComplete) {
        await sessionRepo.updateSessionState(id, 'SESSION_COMPLETED', new Date().toISOString());

        // Update SM-2 review items
        const initialSm2 = {
          easeFactor: 2.5,
          intervalDays: 1,
          repetitions: 0,
          nextDue: new Date().toISOString(),
        };
        const nextSm2 = calculateSM2(initialSm2, stepEval.qualityScore);
        await sessionRepo.recordReviewItem(topic.id, stepNumber, topic.category, nextSm2);

        // Generate English feedback report
        try {
          const userMsgs = (await sessionRepo.getMessages(id))
            .filter((m) => m.role === 'user')
            .map((m) => m.content);

          const englishReport = await evaluateEnglish(router, userMsgs);
          await sessionRepo.recordEnglishReport(id, englishReport);
        } catch {
          // Graceful fallback for offline / test
        }
      }

      // Send 'done' SSE event
      sendSSE('done', {
        sessionId: id,
        currentStep: sm.getCurrentStepNumber(),
        state: sm.getState(),
        completed: isComplete,
        hintsRemaining: sm.getHintsRemaining(),
      });

      reply.raw.end();
    } catch (err: unknown) {
      sendSSE('error', {
        code: 'STREAM_ERROR',
        message: (err as Error).message || 'An error occurred during evaluation',
      });
      reply.raw.end();
    }
  });

  // POST /api/v1/sessions/:id/hint — Request hint (ladder cap enforced)
  app.post('/:id/hint', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const session = await sessionRepo.getSession(id);
    if (!session) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const topic = await topicRepo.getTopicById(session.topicId);
    if (!topic) {
      return reply.status(404).send({ error: { code: 'TOPIC_NOT_FOUND', message: 'Topic not found' } });
    }

    const steps = await sessionRepo.getSteps(id);
    const sm = getOrRestoreStateMachine(id, session, topic, steps);

    try {
      const hintResult = sm.requestHint();

      // Record hint in messages
      await sessionRepo.addMessage({
        sessionId: id,
        role: 'coach',
        content: `💡 [Hint ${hintResult.hintLevel}/2]: ${hintResult.hintText}`,
        stepNumber: sm.getCurrentStepNumber(),
      });

      return reply.send({
        sessionId: id,
        ...hintResult,
      });
    } catch (err: unknown) {
      return reply.status(400).send({
        error: { code: 'MAX_HINTS_REACHED', message: (err as Error).message },
      });
    }
  });

  // POST /api/v1/sessions/:id/skip — Skip current step
  app.post('/:id/skip', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const session = await sessionRepo.getSession(id);
    if (!session) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const topic = await topicRepo.getTopicById(session.topicId);
    if (!topic) {
      return reply.status(404).send({ error: { code: 'TOPIC_NOT_FOUND', message: 'Topic not found' } });
    }

    const steps = await sessionRepo.getSteps(id);
    const sm = getOrRestoreStateMachine(id, session, topic, steps);
    const skippedStepNumber = sm.getCurrentStepNumber();
    const stepData = sm.getCurrentStepData();

    const skipResult = sm.skipStep();

    // Model answer for learner review
    const levelKey = session.level === 'foundation' ? 'junior' : session.level === 'working' ? 'mid' : 'senior';
    const modelAnswerText = stepData?.modelAnswer[levelKey] || 'Model solution provided for study.';

    await sessionRepo.addMessage({
      sessionId: id,
      role: 'coach',
      content: `⏩ Step skipped. Model Answer:\n${modelAnswerText}`,
      stepNumber: skippedStepNumber,
    });

    await sessionRepo.recordStep({
      sessionId: id,
      stepNumber: skippedStepNumber,
      stepSlug: skipResult.stepSlug,
      qualityScore: skipResult.qualityScore,
      independenceScore: skipResult.independenceScore,
      compositeScore: skipResult.compositeScore,
      userAnswer: '(Skipped)',
      modelAnswer: modelAnswerText,
      completedAt: new Date().toISOString(),
    });

    return reply.send({
      sessionId: id,
      skippedStepNumber,
      nextStepNumber: sm.getCurrentStepNumber(),
      state: sm.getState(),
      completed: sm.isFinished(),
      modelAnswer: modelAnswerText,
    });
  });
}
