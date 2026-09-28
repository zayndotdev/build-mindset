import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { AIRouter } from '../src/router';
import { MockAdapter } from '../src/adapters/mock';
import { generateStructured, cleanJsonOutput } from '../src/structured';
import { MalformedOutputError } from '../src/types';

describe('Structured Output & Schema Repair Engine', () => {
  let router: AIRouter;
  let mock: MockAdapter;

  const GradeRubricSchema = z.object({
    qualityScore: z.number().min(1).max(4),
    independenceScore: z.number().min(0).max(4),
    coveredKeyPoints: z.array(z.string()),
    missedKeyPoints: z.array(z.string()),
    feedback: z.string(),
  });

  beforeEach(() => {
    router = new AIRouter({ priority: ['mock'] });
    mock = new MockAdapter('mock', 'Mock Evaluator');
    router.registerProvider(mock);
  });

  it('strips markdown code fences cleanly', () => {
    const rawFenced = '```json\n{"qualityScore": 3}\n```';
    expect(cleanJsonOutput(rawFenced)).toBe('{"qualityScore": 3}');

    const rawPlain = '{"qualityScore": 4}';
    expect(cleanJsonOutput(rawPlain)).toBe('{"qualityScore": 4}');
  });

  it('successfully extracts valid structured JSON', async () => {
    const validJson = JSON.stringify({
      qualityScore: 4,
      independenceScore: 4,
      coveredKeyPoints: ['Data modeling', 'Indexes'],
      missedKeyPoints: [],
      feedback: 'Excellent response.',
    });
    mock.setBehavior({ content: `\`\`\`json\n${validJson}\n\`\`\`` });

    const result = await generateStructured(router, {
      messages: [{ role: 'user', content: 'Grade answer' }],
      schema: GradeRubricSchema,
    });

    expect(result.data.qualityScore).toBe(4);
    expect(result.data.independenceScore).toBe(4);
    expect(result.data.coveredKeyPoints).toContain('Data modeling');
    expect(result.repaired).toBeFalsy();
  });

  it('triggers automatic repair prompt when initial response has malformed JSON and recovers', async () => {
    // 1st call returns broken JSON; 2nd call (repair) returns valid JSON
    let call = 0;
    const originalGenerate = mock.generate.bind(mock);
    mock.generate = async (opts) => {
      call++;
      if (call === 1) {
        return {
          content: 'Here is your evaluation: { qualityScore: 3, broken syntax without quotes }',
          model: 'mock-model-v1',
          providerId: 'mock',
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          finishReason: 'stop',
        };
      } else {
        return {
          content: JSON.stringify({
            qualityScore: 3,
            independenceScore: 3,
            coveredKeyPoints: ['Argon2id'],
            missedKeyPoints: ['Timing safe check'],
            feedback: 'Fixed valid JSON.',
          }),
          model: 'mock-model-v1',
          providerId: 'mock',
          usage: { promptTokens: 20, completionTokens: 15, totalTokens: 35 },
          finishReason: 'stop',
        };
      }
    };

    const result = await generateStructured(router, {
      messages: [{ role: 'user', content: 'Grade answer' }],
      schema: GradeRubricSchema,
    });

    expect(call).toBe(2);
    expect(result.repaired).toBe(true);
    expect(result.data.qualityScore).toBe(3);
    expect(result.data.coveredKeyPoints).toContain('Argon2id');
  });

  it('throws MalformedOutputError if both initial output and repair prompt fail', async () => {
    mock.setBehavior({ mode: 'malformed_json' });

    await expect(
      generateStructured(router, {
        messages: [{ role: 'user', content: 'Grade' }],
        schema: GradeRubricSchema,
      })
    ).rejects.toThrow(MalformedOutputError);
  });
});
