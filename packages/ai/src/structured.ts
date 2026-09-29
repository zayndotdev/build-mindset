import { z } from 'zod';
import { AIRouter } from './router';
import {
  LLMMessage,
  GenerateOptions,
  TokenUsage,
  MalformedOutputError,
} from './types';
import type { ProviderId } from '@mindset/shared';

export interface StructuredOptions<T> {
  messages: LLMMessage[];
  schema: z.ZodType<T>;
  schemaName?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface StructuredResult<T> {
  data: T;
  raw: string;
  model: string;
  providerId: ProviderId;
  usage: TokenUsage;
  repaired?: boolean;
}

export function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export async function generateStructured<T>(
  router: AIRouter,
  options: StructuredOptions<T>
): Promise<StructuredResult<T>> {
  const baseGenerateOptions: GenerateOptions = {
    messages: options.messages,
    temperature: options.temperature ?? 0.2, // Low temperature for deterministic structured extraction
    maxTokens: options.maxTokens ?? 2048,
    responseFormat: 'json',
    signal: options.signal,
  };

  try {
    const rawResult = await router.generate(baseGenerateOptions);
    const cleaned = cleanJsonOutput(rawResult.content);

    try {
      const parsedJson = JSON.parse(cleaned);
      const validated = options.schema.parse(parsedJson);

      return {
        data: validated,
        raw: rawResult.content,
        model: rawResult.model,
        providerId: rawResult.providerId,
        usage: rawResult.usage,
      };
    } catch (parseOrValidationError) {
      // Step 2: Attempt targeted repair prompt
      const repairErrorMsg =
        parseOrValidationError instanceof z.ZodError
          ? JSON.stringify(parseOrValidationError.format())
          : (parseOrValidationError as Error).message;

      const repairMessages: LLMMessage[] = [
        ...options.messages,
        { role: 'assistant', content: rawResult.content },
        {
          role: 'user',
          content: `Your previous response was either malformed JSON or did not conform to the expected schema.\nError details:\n${repairErrorMsg}\n\nPlease output ONLY the corrected, valid JSON object with no preamble or markdown wrapping.`,
        },
      ];

      const repairResult = await router.generate({
        ...baseGenerateOptions,
        messages: repairMessages,
        temperature: 0.1,
      });

      const cleanedRepair = cleanJsonOutput(repairResult.content);
      const parsedRepair = JSON.parse(cleanedRepair);
      const validatedRepair = options.schema.parse(parsedRepair);

      return {
        data: validatedRepair,
        raw: repairResult.content,
        model: repairResult.model,
        providerId: repairResult.providerId,
        usage: {
          promptTokens: rawResult.usage.promptTokens + repairResult.usage.promptTokens,
          completionTokens: rawResult.usage.completionTokens + repairResult.usage.completionTokens,
          totalTokens: rawResult.usage.totalTokens + repairResult.usage.totalTokens,
        },
        repaired: true,
      };
    }
  } catch (finalError: unknown) {
    throw new MalformedOutputError(
      'mock',
      `Structured extraction failed: ${(finalError as Error).message}`
    );
  }
}

export async function parseStructuredOutput<T>(
  raw: string,
  schema: z.ZodType<T>,
  router?: AIRouter,
  providerId?: ProviderId
): Promise<T> {
  const cleaned = cleanJsonOutput(raw);
  try {
    const parsed = JSON.parse(cleaned);
    return schema.parse(parsed);
  } catch (initialErr) {
    if (!router) {
      throw new MalformedOutputError(
        providerId ?? 'gemini',
        `Failed to parse JSON output: ${(initialErr as Error).message}`,
        raw
      );
    }

    try {
      const repairResult = await router.generate({
        messages: [
          {
            role: 'system',
            content: 'You are a JSON repair specialist. Output ONLY the corrected valid JSON, with no markdown fences.',
          },
          {
            role: 'user',
            content: `Fix the following malformed JSON according to this structure:\n${raw}`,
          },
        ],
        temperature: 0.1,
        responseFormat: 'json',
      });

      const cleanedRepair = cleanJsonOutput(repairResult.content);
      const parsedRepair = JSON.parse(cleanedRepair);
      return schema.parse(parsedRepair);
    } catch {
      throw new MalformedOutputError(
        providerId ?? 'gemini',
        `Failed to parse or repair structured output: ${(initialErr as Error).message}`,
        raw
      );
    }
  }
}
