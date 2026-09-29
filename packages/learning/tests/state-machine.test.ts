import { describe, it, expect, beforeEach } from 'vitest';
import { SocraticStateMachine } from '../src/state-machine';
import { buildGraderSystemPrompt } from '../src/prompts';
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
    expect(stepResult.compositeScore).toBe(3); // min(quality, independence) = min(4, 3) = 3 per D-013 / D-021
    expect(stepResult.isStepPass).toBe(true);

    // Advanced to step 2 with fresh hint budget
    expect(sm.getCurrentStepNumber()).toBe(2);
    expect(sm.getHintsUsed()).toBe(0);
    expect(sm.getHintsRemaining()).toBe(2);
    expect(sm.getState()).toBe('QUESTION');
  });

  it('skips step with independence score = 0 and advances', () => {
    const skipResult = sm.skipStep();
    expect(skipResult.qualityScore).toBe(0);
    expect(skipResult.independenceScore).toBe(0);
    expect(skipResult.compositeScore).toBe(0); // min(0, 0) = 0 per D-013 / D-021
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

  it('proves the engine uses topic-specific standardSteps and steps[n].keyPoints (not generic step names)', () => {
    const customTopic: Topic = {
      id: 'custom-distributed-db',
      title: 'Distributed Database Partitioning',
      category: 'database',
      difficulty: 'advanced',
      prerequisites: [],
      learningObjectives: ['Learn sharding'],
      keyTradeoffs: ['Consistent hashing vs Range partitioning'],
      commonPitfalls: ['Hotspots'],
      transferTopicId: 'transfer-partitioning',
      transferPrompt: 'How would you rebalance shards dynamically?',
      standardSteps: [1, 5, 8, 9],
      estimatedMinutes: 15,
      tags: ['database'],
      isCustom: false,
      isActive: true,
      steps: {
        '1': {
          coachQuestion: 'What partitioning key would you choose for high-throughput writes?',
          keyPoints: {
            junior: [{ point: 'Evaluate partition key cardinality', isCore: true }],
            mid: [{ point: 'Evaluate write distribution and hotspot risk', isCore: true }],
            senior: [{ point: 'Evaluate write distribution and hotspot risk', isCore: true }],
          },
          modelAnswer: {
            junior: 'Choose high cardinality key',
            mid: 'Choose high cardinality key',
            senior: 'Choose high cardinality key',
          },
        },
        '5': {
          coachQuestion: 'How will cross-shard transactions be coordinated?',
          keyPoints: {
            junior: [{ point: 'Two-phase commit (2PC) or Saga pattern', isCore: true }],
            mid: [{ point: 'Two-phase commit (2PC) or Saga pattern', isCore: true }],
            senior: [{ point: 'Two-phase commit (2PC) or Saga pattern', isCore: true }],
          },
          modelAnswer: {
            junior: 'Use Saga or 2PC',
            mid: 'Use Saga or 2PC',
            senior: 'Use Saga or 2PC',
          },
        },
        '8': {
          coachQuestion: 'What happens during network partitions between shard leaders?',
          keyPoints: {
            junior: [{ point: 'Raft consensus quorum requirements', isCore: true }],
            mid: [{ point: 'Raft consensus quorum requirements', isCore: true }],
            senior: [{ point: 'Raft consensus quorum requirements', isCore: true }],
          },
          modelAnswer: {
            junior: 'Quorum split-brain prevention',
            mid: 'Quorum split-brain prevention',
            senior: 'Quorum split-brain prevention',
          },
        },
        '9': {
          coachQuestion: 'Design the read path for scatter-gather queries.',
          keyPoints: {
            junior: [{ point: 'Scatter-gather query coordinator with fanout timeout', isCore: true }],
            mid: [{ point: 'Scatter-gather query coordinator with fanout timeout', isCore: true }],
            senior: [{ point: 'Scatter-gather query coordinator with fanout timeout', isCore: true }],
          },
          modelAnswer: {
            junior: 'Scatter gather router',
            mid: 'Scatter gather router',
            senior: 'Scatter gather router',
          },
        },
      },
    };

    const engine = new SocraticStateMachine({
      sessionId: 'sess-custom-steps',
      topic: customTopic,
      level: 'working',
      sessionMode: 'standard',
    });

    // 1. Proves stepsToRun strictly uses standardSteps [1, 5, 8, 9] (not generic [1, 2, 3, 4])
    expect(engine.stepsToRun).toEqual([1, 5, 8, 9]);

    // 2. Step 1 uses topic-specific question and key points
    expect(engine.getCurrentStepNumber()).toBe(1);
    const step1Data = engine.getCurrentStepData();
    expect(step1Data?.coachQuestion).toBe('What partitioning key would you choose for high-throughput writes?');
    expect(step1Data?.keyPoints.mid[0].point).toBe('Evaluate write distribution and hotspot risk');

    // Verify grader prompt incorporates the topic's specific question & key points (not generic step labels)
    const prompt1 = buildGraderSystemPrompt(customTopic, step1Data!, 'working');
    expect(prompt1).toContain('TOPIC: Distributed Database Partitioning');
    expect(prompt1).toContain('QUESTION: What partitioning key would you choose for high-throughput writes?');
    expect(prompt1).toContain('- Evaluate write distribution and hotspot risk');
    expect(prompt1).not.toContain('Step 1: Clarifying Requirements');

    // Advance to next step
    engine.submitAnswer('I choose a UUID hash', {
      qualityScore: 3,
      coveredKeyPoints: ['Evaluate write distribution and hotspot risk'],
      missingKeyPoints: [],
      feedback: 'Good.',
      suggestedFollowup: '',
      isPass: true,
    });

    // 3. Proves next step is Step 5 (from standardSteps[1]), NOT Step 2
    expect(engine.getCurrentStepNumber()).toBe(5);
    const step5Data = engine.getCurrentStepData();
    expect(step5Data?.coachQuestion).toBe('How will cross-shard transactions be coordinated?');
    expect(step5Data?.keyPoints.mid[0].point).toBe('Two-phase commit (2PC) or Saga pattern');

    const prompt5 = buildGraderSystemPrompt(customTopic, step5Data!, 'working');
    expect(prompt5).toContain('QUESTION: How will cross-shard transactions be coordinated?');
    expect(prompt5).toContain('- Two-phase commit (2PC) or Saga pattern');
    expect(prompt5).not.toContain('Step 2: Data Model');
  });
});
