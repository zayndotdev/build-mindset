import { describe, it, expect } from 'vitest';
import { SocraticStateMachine } from '../src/state-machine';
import { runPersonaSimulation, SCRIPTED_PERSONAS } from '../src/eval-harness';
import { AIRouter, MockAdapter } from '@mindset/ai';
import type { Topic } from '@mindset/shared';

const testTopic: Topic = {
  id: 'test-auth-topic',
  title: 'Auth Topic',
  category: 'authentication',
  difficulty: 'beginner',
  prerequisites: [],
  learningObjectives: ['Auth basics'],
  keyTradeoffs: ['Sessions vs JWT'],
  commonPitfalls: ['Plaintext passwords'],
  transferTopicId: 'test-transfer',
  transferPrompt: 'Transfer challenge question',
  standardSteps: [1, 2],
  estimatedMinutes: 10,
  tags: ['auth'],
  isCustom: false,
  isActive: true,
  steps: {
    '1': {
      coachQuestion: 'What requirements would you ask?',
      keyPoints: {
        junior: [{ point: 'Target users', isCore: true }],
        mid: [{ point: 'Target users', isCore: true }],
        senior: [{ point: 'Target users', isCore: true }],
      },
    },
    '2': {
      coachQuestion: 'How would you store credentials?',
      keyPoints: {
        junior: [{ point: 'Argon2id hashing', isCore: true }],
        mid: [{ point: 'Argon2id hashing', isCore: true }],
        senior: [{ point: 'Argon2id hashing', isCore: true }],
      },
    },
  },
};

describe('Eval Harness & Scripted Personas', () => {
  it('runs Senior Architect simulation achieving high quality without hints', async () => {
    const router = new AIRouter({ priority: ['gemini'] });
    const mock = new MockAdapter('gemini', 'Mock Gemini');
    mock.setBehavior({
      content: JSON.stringify({
        qualityScore: 4,
        coveredKeyPoints: ['Target users', 'Argon2id hashing'],
        missingKeyPoints: [],
        feedback: 'Excellent architectural answer.',
        suggestedFollowup: '',
        isPass: true,
      }),
    });
    router.registerProvider(mock);

    const sm = new SocraticStateMachine({
      sessionId: 'senior-sim-1',
      topic: testTopic,
      level: 'working',
      sessionMode: 'standard',
    });

    const sim = await runPersonaSimulation(SCRIPTED_PERSONAS.senior_architect!, sm, router);
    expect(sim.completed).toBe(true);
    expect(sim.averageQuality).toBe(4);
    expect(sim.averageIndependence).toBe(4); // No hints used
    expect(sim.averageComposite).toBe(4);
  });

  it('runs Struggling Beginner simulation using hint ladder and showing independence drop', async () => {
    const router = new AIRouter({ priority: ['gemini'] });
    const mock = new MockAdapter('gemini', 'Mock Gemini');
    mock.setBehavior({
      content: JSON.stringify({
        qualityScore: 3,
        coveredKeyPoints: ['Target users'],
        missingKeyPoints: [],
        feedback: 'Good clarification after hint.',
        suggestedFollowup: '',
        isPass: true,
      }),
    });
    router.registerProvider(mock);

    const sm = new SocraticStateMachine({
      sessionId: 'beginner-sim-1',
      topic: testTopic,
      level: 'foundation',
      sessionMode: 'standard',
    });

    const sim = await runPersonaSimulation(SCRIPTED_PERSONAS.struggling_beginner!, sm, router);
    expect(sim.completed).toBe(true);
    expect(sim.averageQuality).toBe(3);
    // Because beginner requested hints, average independence score dropped from 4 to 3
    expect(sim.averageIndependence).toBe(3);
    expect(sim.averageComposite).toBe(3); // 3*0.7 + 3*0.3 = 3
  });

  it('runs Minimalist Skipper simulation testing step skip mechanics', async () => {
    const router = new AIRouter({ priority: ['gemini'] });
    const mock = new MockAdapter('gemini', 'Mock Gemini');
    mock.setBehavior({
      content: JSON.stringify({
        qualityScore: 3,
        coveredKeyPoints: ['Target users'],
        missingKeyPoints: [],
        feedback: 'Good start.',
        suggestedFollowup: '',
        isPass: true,
      }),
    });
    router.registerProvider(mock);

    const sm = new SocraticStateMachine({
      sessionId: 'skipper-sim-1',
      topic: testTopic,
      level: 'foundation',
      sessionMode: 'standard',
    });

    const sim = await runPersonaSimulation(SCRIPTED_PERSONAS.minimalist_skipper!, sm, router);
    expect(sim.completed).toBe(true);
    // Step 1: answered (Q3, Ind4) -> Composite 3.3
    // Step 2: skipped (Q1, Ind0) -> Composite 0.7
    expect(sim.results).toHaveLength(2);
    expect(sim.results[1]!.independenceScore).toBe(0);
  });
});
