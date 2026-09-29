import type { Topic, TopicStepData } from '@mindset/shared';
import { AIRouter, parseStructuredOutput, PinnedGraderProvenance } from '@mindset/ai';
import { SessionLevel, RubricEvaluation, RubricEvaluationSchema } from './types';
import { buildGraderSystemPrompt } from './prompts';

export interface GradeAnswerResult {
  rubric: RubricEvaluation;
  provenance: PinnedGraderProvenance;
}

export async function gradeUserAnswer(
  router: AIRouter,
  topic: Topic,
  stepData: TopicStepData,
  level: SessionLevel,
  userAnswer: string
): Promise<GradeAnswerResult> {
  const systemPrompt = buildGraderSystemPrompt(topic, stepData, level);

  const { result, provenance } = await router.generateWithPinnedGrader({
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Learner Answer:\n${userAnswer}`,
      },
    ],
    temperature: 0.1, // low temperature for grading consistency
    responseFormat: 'json',
  });

  const rubric = await parseStructuredOutput(
    result.content,
    RubricEvaluationSchema,
    router,
    provenance.graderId
  );

  return {
    rubric,
    provenance,
  };
}
