import { describe, it, expect, beforeEach } from 'vitest';
import { SocraticStateMachine } from '../src/state-machine';
import type { Topic } from '@mindset/shared';

const mockTopic: Topic = {
  id: 'test-topic',
  title: 'Test Auth Topic',
  category: 'authentication',
  difficulty: 'beginner',
  prerequisites: [],
  learningObjectives: ['Learn auth'],
  keyTradeoffs: ['Sessions vs Tokens'],
  commonPitfalls: ['Plaintext passwords'],
  transferTopicId: 'test-transfer',
  transferPrompt: 'How would you scale this to 10M users?',
  standardSteps: [1, 2, 3, 4],
  estimatedMinutes: 10,
  tags: ['test'],
  isCustom: false,
  isActive: true,
  steps: {
    '1': {
      coachQuestion: 'What requirements would you clarify first?',
      keyPoints: {
        junior: [{ point: 'Target users', isCore: true }],
        mid: [{ point: 'Target users', isCore: true }],
        senior: [{ point: 'Target users', isCore: true }],
      },
    },
    '2': {
      coachQuestion: 'How would you store passwords?',
      keyPoints: {
        junior: [{ point: 'Argon2id hashing', isCore: true }],
        mid: [{ point: 'Argon2id hashing', isCore: true }],
        senior: [{ point: 'Argon2id hashing', isCore: true }],
      },
    },
    '3': {
      coachQuestion: 'How would you handle sessions?',
      keyPoints: {
        junior: [{ point: 'HttpOnly cookie', isCore: true }],
        mid: [{ point: 'HttpOnly cookie', isCore: true }],
        senior: [{ point: 'HttpOnly cookie', isCore: true }],
      },
    },
    '4': {
      coachQuestion: 'What are the failure modes?',
      keyPoints: {
        junior: [{ point: 'Brute force lockout', isCore: true }],
        mid: [{ point: 'Brute force lockout', isCore: true }],
        senior: [{ point: 'Brute force lockout', isCore: true }],
      },
    },
  },
};

describe('SocraticStateMachine (Learning Engine Core)', () => {
  let sm: SocraticStateMachine;

  beforeEach(() => {
    sm = new SocraticStateMachine({
      sessionId: 'test-sess-1',
      topic: mockTopic,
      level: 'working',
      sessionMode: 'standard',
    });
  });

  it('initializes at step 1 in QUESTION state with 0 hints and 4 standard steps', () => {
    expect(sm.getState()).toBe('QUESTION');
    expect(sm.getCurrentStepNumber()).toBe(1);
    expect(sm.getHintsUsed()).toBe(0);
    expect(sm.getHintsRemaining()).toBe(2);
    expect(sm.stepsToRun).toEqual([1, 2, 3, 4]);
  });

  it('enforces the hint ladder and caps hints at 2 per step', () => {
    // 1st Hint
    const h1 = sm.requestHint();
    expect(h1.hintLevel).toBe(1);
    expect(h1.hintsRemaining).toBe(1);
    expect(h1.newIndependenceScore).toBe(3);
    expect(sm.getState()).toBe('HINT_GIVEN');

    // 2nd Hint
    const h2 = sm.requestHint();
    expect(h2.hintLevel).toBe(2);
    expect(h2.hintsRemaining).toBe(0);
    expect(h2.newIndependenceScore).toBe(2);

    // 3rd Hint: Capped! Throws error
    expect(() => sm.requestHint()).toThrow(/Maximum hints \(2\) already reached/);
    expect(sm.getHintsUsed()).toBe(2);
    expect(sm.getHintsRemaining()).toBe(0);
  });

  it('records successful answer (quality >= 3) and advances to next step with reset hint counter', () => {
    // Uses 1 hint on step 1
    sm.requestHint();
    expect(sm.getHintsUsed()).toBe(1);

    const stepResult = sm.submitAnswer('I would clarify target user personas and scale.', {
      qualityScore: 4,
      coveredKeyPoints: ['Target users'],
      missingKeyPoints: [],
      feedback: 'Excellent clarification.',
      suggestedFollowup: '',
      isPass: true,
    });

    expect(stepResult.qualityScore).toBe(4);
    expect(stepResult.independenceScore).toBe(3); // 1 hint used -> 3
    expect(stepResult.compositeScore).toBe(3.7); // 4 * 0.7 + 3 * 0.3 = 2.8 + 0.9 = 3.7
    expect(stepResult.isStepPass).toBe(true);

    // Advanced to step 2 with fresh hint budget
    expect(sm.getCurrentStepNumber()).toBe(2);
    expect(sm.getHintsUsed()).toBe(0);
    expect(sm.getHintsRemaining()).toBe(2);
    expect(sm.getState()).toBe('QUESTION');
  });

  it('skips step with independence score = 0 and advances', () => {
    const skipResult = sm.skipStep();
    expect(skipResult.qualityScore).toBe(1);
    expect(skipResult.independenceScore).toBe(0);
    expect(skipResult.compositeScore).toBe(0.7); // 1 * 0.7 + 0 * 0.3 = 0.7
    expect(sm.getCurrentStepNumber()).toBe(2);
  });

  it('advances after 3 unsuccessful attempts to avoid learner gridlock', () => {
    const poorRubric = {
      qualityScore: 2,
      coveredKeyPoints: [],
      missingKeyPoints: ['Target users'],
      feedback: 'Incomplete.',
      suggestedFollowup: 'Consider users.',
      isPass: false,
    };

    // Attempt 1
    const r1 = sm.submitAnswer('bad 1', poorRubric);
    expect(r1.canAdvance).toBe(false);
    expect(sm.getState()).toBe('FEEDBACK');
    expect(sm.getCurrentStepNumber()).toBe(1);

    // Attempt 2
    const r2 = sm.submitAnswer('bad 2', poorRubric);
    expect(r2.canAdvance).toBe(false);

    // Attempt 3: Advances automatically
    const r3 = sm.submitAnswer('bad 3', poorRubric);
    expect(r3.canAdvance).toBe(true);
    expect(sm.getCurrentStepNumber()).toBe(2);
  });

  it('supports Quick Mode (2 steps + transfer challenge)', () => {
    const quickSm = new SocraticStateMachine({
      sessionId: 'quick-sess-1',
      topic: mockTopic,
      level: 'foundation',
      sessionMode: 'quick',
    });

    expect(quickSm.stepsToRun).toEqual([1, 2]);

    // Step 1
    quickSm.submitAnswer('good answer 1', {
      qualityScore: 3,
      coveredKeyPoints: ['Target users'],
      missingKeyPoints: [],
      feedback: 'Good.',
      suggestedFollowup: '',
      isPass: true,
    });

    // Step 2
    quickSm.submitAnswer('good answer 2', {
      qualityScore: 3,
      coveredKeyPoints: ['Argon2id hashing'],
      missingKeyPoints: [],
      feedback: 'Good.',
      suggestedFollowup: '',
      isPass: true,
    });

    // Transitions to TRANSFER_CHALLENGE
    expect(quickSm.getState()).toBe('TRANSFER_CHALLENGE');

    // Submit transfer
    quickSm.submitTransfer({
      qualityScore: 4,
      coveredKeyPoints: ['Scale partitioning'],
      missingKeyPoints: [],
      feedback: 'Great scale transfer.',
      suggestedFollowup: '',
      isPass: true,
    });

    expect(quickSm.isFinished()).toBe(true);
    expect(quickSm.getState()).toBe('SESSION_COMPLETED');
  });
});
