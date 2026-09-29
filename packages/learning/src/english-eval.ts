import { z } from 'zod';
import { AIRouter, parseStructuredOutput } from '@mindset/ai';
import { EnglishFeedback } from './types';
import { buildEnglishFeedbackPrompt } from './prompts';

export const EnglishFeedbackSchema = z.object({
  fluencyScore: z.number().min(0).max(100),
  grammarScore: z.number().min(0).max(100),
  concisenessScore: z.number().min(0).max(100),
  feedback: z.string(),
  suggestions: z.array(z.string()),
  corrections: z.array(
    z.object({
      original: z.string(),
      corrected: z.string(),
      explanation: z.string(),
    })
  ),
  technicalVocab: z.array(
    z.object({
      originalTerm: z.string(),
      suggestedTerm: z.string(),
      rationale: z.string(),
    })
  ),
  seniorRewrite: z.string(),
  pronunciationNote: z.string().optional(),
});

export async function evaluateEnglish(
  router: AIRouter,
  userResponses: string[]
): Promise<EnglishFeedback> {
  const systemPrompt = buildEnglishFeedbackPrompt();
  const transcriptText = userResponses
    .map((resp, i) => `Response #${i + 1}:\n${resp}`)
    .join('\n\n');

  const result = await router.generate({
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Engineer's responses during session:\n${transcriptText}`,
      },
    ],
    temperature: 0.2,
    responseFormat: 'json',
  });

  return await parseStructuredOutput(
    result.content,
    EnglishFeedbackSchema,
    router,
    result.providerId
  );
}
