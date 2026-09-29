import { SocraticStateMachine } from './state-machine';
import { AIRouter } from '@mindset/ai';
import { gradeUserAnswer } from './grader';
import { StepEvaluationResult } from './types';

export interface Persona {
  id: string;
  name: string;
  description: string;
  answerStrategy: (
    stepNumber: number,
    coachQuestion: string,
    attempt: number,
    hintsUsed: number
  ) => {
    action: 'answer' | 'request_hint' | 'skip';
    text?: string;
  };
}

export const SCRIPTED_PERSONAS: Record<string, Persona> = {
  struggling_beginner: {
    id: 'struggling_beginner',
    name: 'Struggling Beginner',
    description: 'Requests hints on difficult steps and provides basic initial answers.',
    answerStrategy: (stepNumber, _coachQuestion, _attempt, hintsUsed) => {
      if (hintsUsed === 0) {
        return { action: 'request_hint' };
      }
      return {
        action: 'answer',
        text: `For step ${stepNumber}, I clarify target users and basic email authentication.`,
      };
    },
  },

  senior_architect: {
    id: 'senior_architect',
    name: 'Senior Architect',
    description: 'Provides thorough architectural answers analyzing trade-offs, scalability, and edge cases.',
    answerStrategy: (stepNumber, _coachQuestion) => {
      return {
        action: 'answer',
        text: `For step ${stepNumber}, we must clarify user tiers (admin vs consumer), peak throughput requirements, multi-device session concurrency limits, and password policy constraints. We store credentials using Argon2id with 16-byte random salts in a separate credentials table, enforce constant-time hash comparisons, and rate limit authentication attempts with exponential backoff.`,
      };
    },
  },

  minimalist_skipper: {
    id: 'minimalist_skipper',
    name: 'Minimalist Skipper',
    description: 'Attempts first step, then exercises skip button.',
    answerStrategy: (stepNumber) => {
      if (stepNumber === 1) {
        return { action: 'answer', text: 'We ask how many users we have.' };
      }
      return { action: 'skip' };
    },
  },
};

export interface PersonaSimulationResult {
  personaId: string;
  completed: boolean;
  stepsCount: number;
  results: StepEvaluationResult[];
  averageQuality: number;
  averageIndependence: number;
  averageComposite: number;
}

export async function runPersonaSimulation(
  persona: Persona,
  sm: SocraticStateMachine,
  router: AIRouter
): Promise<PersonaSimulationResult> {
  const maxIterations = 20;
  let iterations = 0;

  while (!sm.isFinished() && iterations < maxIterations) {
    iterations++;

    if (sm.getState() === 'TRANSFER_CHALLENGE') {
      const stepData = sm.getCurrentStepData() || {
        coachQuestion: sm.topic.transferPrompt,
        keyPoints: { junior: [], mid: [], senior: [] },
        modelAnswer: { junior: 'Model transfer answer', mid: 'Model transfer answer', senior: 'Model transfer answer' },
      };
      const { rubric } = await gradeUserAnswer(
        router,
        sm.topic,
        stepData,
        sm.level,
        'My transfer challenge solution'
      );
      sm.submitTransfer(rubric);
      break;
    }

    const stepNumber = sm.getCurrentStepNumber();
    const stepData = sm.getCurrentStepData();
    if (!stepData) break;

    const attempt = sm.getAttempts() + 1;
    const hintsUsed = sm.getHintsUsed();
    const decision = persona.answerStrategy(stepNumber, stepData.coachQuestion, attempt, hintsUsed);

    if (decision.action === 'request_hint') {
      try {
        sm.requestHint();
      } catch {
        // If max hints reached, fallback to answering
        const fallbackAns = persona.answerStrategy(stepNumber, stepData.coachQuestion, 3, hintsUsed);
        const { rubric } = await gradeUserAnswer(
          router,
          sm.topic,
          stepData,
          sm.level,
          fallbackAns.text || 'Fallback answer'
        );
        sm.submitAnswer(fallbackAns.text || 'Fallback answer', rubric);
      }
    } else if (decision.action === 'skip') {
      sm.skipStep();
    } else {
      const { rubric } = await gradeUserAnswer(
        router,
        sm.topic,
        stepData,
        sm.level,
        decision.text || 'My architecture answer'
      );
      sm.submitAnswer(decision.text || 'My architecture answer', rubric);
    }
  }

  const results = sm.getStepResults();
  const avgQuality =
    results.length > 0 ? results.reduce((a, b) => a + b.qualityScore, 0) / results.length : 0;
  const avgIndependence =
    results.length > 0 ? results.reduce((a, b) => a + b.independenceScore, 0) / results.length : 0;
  const avgComposite =
    results.length > 0 ? results.reduce((a, b) => a + b.compositeScore, 0) / results.length : 0;

  return {
    personaId: persona.id,
    completed: sm.isFinished(),
    stepsCount: results.length,
    results,
    averageQuality: Math.round(avgQuality * 100) / 100,
    averageIndependence: Math.round(avgIndependence * 100) / 100,
    averageComposite: Math.round(avgComposite * 100) / 100,
  };
}
