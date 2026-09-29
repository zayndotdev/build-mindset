import type { Topic, TopicStepData } from '@mindset/shared';
import {
  SessionState,
  SessionLevel,
  SessionMode,
  QualityScore,
  IndependenceScore,
  RubricEvaluation,
  HintRequestResult,
  StepEvaluationResult,
} from './types';
import {
  calculateIndependenceScore,
  calculateCompositeScore,
  MAX_HINTS_PER_STEP,
} from './scoring';

export interface SessionConfig {
  sessionId: string;
  topic: Topic;
  level: SessionLevel;
  sessionMode: SessionMode;
}

export class SocraticStateMachine {
  readonly sessionId: string;
  readonly topic: Topic;
  readonly level: SessionLevel;
  readonly sessionMode: SessionMode;
  readonly stepsToRun: number[];

  private currentStepIndex = 0;
  private attempts = 0;
  private hintsUsed = 0;
  private state: SessionState = 'INITIALIZING';
  private stepResults = new Map<number, StepEvaluationResult>();
  private transferResult: StepEvaluationResult | null = null;

  constructor(config: SessionConfig) {
    this.sessionId = config.sessionId;
    this.topic = config.topic;
    this.level = config.level;
    this.sessionMode = config.sessionMode;

    if (config.sessionMode === 'quick') {
      // Quick Mode: first 2 standard steps + transfer challenge
      this.stepsToRun = config.topic.standardSteps.slice(0, 2);
    } else {
      // Standard Mode: 4 standard steps
      this.stepsToRun = [...config.topic.standardSteps];
    }

    this.state = 'QUESTION';
  }

  public getState(): SessionState {
    return this.state;
  }

  public getCurrentStepNumber(): number {
    return this.stepsToRun[this.currentStepIndex] ?? this.stepsToRun[0]!;
  }

  public getCurrentStepData(): TopicStepData | null {
    const stepNum = this.getCurrentStepNumber();
    return this.topic.steps[String(stepNum)] || null;
  }

  public getAttempts(): number {
    return this.attempts;
  }

  public getHintsUsed(): number {
    return this.hintsUsed;
  }

  public getHintsRemaining(): number {
    return Math.max(0, MAX_HINTS_PER_STEP - this.hintsUsed);
  }

  public getStepResults(): StepEvaluationResult[] {
    return Array.from(this.stepResults.values());
  }

  public getTransferResult(): StepEvaluationResult | null {
    return this.transferResult;
  }

  public isFinished(): boolean {
    return this.state === 'SESSION_COMPLETED';
  }

  /**
   * Request a hint for the current step.
   * Hard-capped at MAX_HINTS_PER_STEP (2).
   */
  public requestHint(): HintRequestResult {
    if (this.hintsUsed >= MAX_HINTS_PER_STEP) {
      throw new Error(`Maximum hints (${MAX_HINTS_PER_STEP}) already reached for this step.`);
    }

    this.hintsUsed++;
    const hintLevel = this.hintsUsed as 1 | 2;
    const hintsRemaining = MAX_HINTS_PER_STEP - this.hintsUsed;
    const newIndependenceScore = calculateIndependenceScore(this.hintsUsed, false);

    const stepData = this.getCurrentStepData();
    let hintText = '';
    if (stepData) {
      // Level-appropriate hint selection
      const keyPoints = this.getKeyPointsForCurrentLevel(stepData);
      if (hintLevel === 1) {
        hintText = `Hint: Consider the core requirement around: ${keyPoints[0]?.point || 'the main architectural constraints.'}`;
      } else {
        hintText = `Structured Breakdown: Think about: 1) ${keyPoints[0]?.point || 'Requirements'}, 2) ${keyPoints[1]?.point || 'Trade-offs'}, 3) ${keyPoints[2]?.point || 'Failure modes'}.`;
      }
    }

    this.state = 'HINT_GIVEN';

    return {
      hintLevel,
      hintsRemaining,
      hintText,
      newIndependenceScore,
    };
  }

  /**
   * Submits a user answer and records the rubric evaluation.
   */
  public submitAnswer(_answerText: string, rubric: RubricEvaluation): StepEvaluationResult {
    this.attempts++;
    const stepNumber = this.getCurrentStepNumber();
    const qualityScore = rubric.qualityScore as QualityScore;
    const independenceScore = calculateIndependenceScore(this.hintsUsed, false);
    const compositeScore = calculateCompositeScore(qualityScore, independenceScore);

    const isStepPass = rubric.isPass || qualityScore >= 3;
    const canAdvance = isStepPass || this.attempts >= 3;

    const result: StepEvaluationResult = {
      stepNumber,
      stepSlug: `step-${stepNumber}`,
      qualityScore,
      independenceScore,
      compositeScore,
      rubric,
      isStepPass,
      canAdvance,
    };

    if (canAdvance) {
      this.stepResults.set(stepNumber, result);
      this.advanceStep();
    } else {
      this.state = 'FEEDBACK';
    }

    return result;
  }

  /**
   * Skips the current step.
   * Sets independence score to 0 and advances.
   */
  public skipStep(): StepEvaluationResult {
    const stepNumber = this.getCurrentStepNumber();
    const qualityScore = 0 as QualityScore;
    const independenceScore = 0 as IndependenceScore;
    const compositeScore = calculateCompositeScore(qualityScore, independenceScore);

    const result: StepEvaluationResult = {
      stepNumber,
      stepSlug: `step-${stepNumber}`,
      qualityScore,
      independenceScore,
      compositeScore,
      rubric: {
        qualityScore: 0,
        coveredKeyPoints: [],
        missingKeyPoints: ['Step skipped by learner'],
        feedback: 'Step skipped. Model answer provided for review.',
        suggestedFollowup: '',
        isPass: false,
      },
      isStepPass: false,
      canAdvance: true,
    };

    this.stepResults.set(stepNumber, result);
    this.advanceStep();
    return result;
  }

  /**
   * Submits answer for the transfer challenge.
   */
  public submitTransfer(rubric: RubricEvaluation): StepEvaluationResult {
    const qualityScore = rubric.qualityScore as QualityScore;
    const independenceScore = calculateIndependenceScore(0, false);
    const compositeScore = calculateCompositeScore(qualityScore, independenceScore);

    this.transferResult = {
      stepNumber: 99,
      stepSlug: 'transfer-challenge',
      qualityScore,
      independenceScore,
      compositeScore,
      rubric,
      isStepPass: rubric.isPass,
      canAdvance: true,
    };

    this.state = 'SESSION_COMPLETED';
    return this.transferResult;
  }

  /**
   * Advances to next step, recap, or transfer challenge.
   */
  private advanceStep(): void {
    this.attempts = 0;
    this.hintsUsed = 0;
    this.currentStepIndex++;

    if (this.currentStepIndex < this.stepsToRun.length) {
      this.state = 'QUESTION';
    } else if (this.state !== 'TRANSFER_CHALLENGE' && this.topic.transferPrompt) {
      this.state = 'TRANSFER_CHALLENGE';
    } else {
      this.state = 'SESSION_COMPLETED';
    }
  }

  private getKeyPointsForCurrentLevel(stepData: TopicStepData) {
    // Map foundation -> junior, working -> mid, advanced -> senior
    const levelKey =
      this.level === 'foundation' ? 'junior' : this.level === 'working' ? 'mid' : 'senior';

    return stepData.keyPoints[levelKey] || stepData.keyPoints.junior || [];
  }
}
