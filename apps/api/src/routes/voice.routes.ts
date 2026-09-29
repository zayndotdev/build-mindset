import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/guard';
import { AIService } from '../ai/service';
import { z } from 'zod';

const JsonTranscribeSchema = z.object({
  audioBase64: z.string().min(1, 'Audio base64 data is required'),
  mimeType: z.string().optional().default('audio/webm'),
  language: z.string().optional(),
  prompt: z.string().optional(),
});

export async function voiceRoutes(app: FastifyInstance): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiService = (app as any).aiService as AIService;

  // POST /api/v1/voice/transcribe
  app.post('/transcribe', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    let audioBuffer: Buffer | null = null;
    let mimeType = 'audio/webm';
    let language: string | undefined;
    let prompt: string | undefined;

    const contentType = request.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      const parsed = JsonTranscribeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'INVALID_AUDIO', message: 'Valid audioBase64 string is required' },
        });
      }
      try {
        audioBuffer = Buffer.from(parsed.data.audioBase64, 'base64');
        mimeType = parsed.data.mimeType;
        language = parsed.data.language;
        prompt = parsed.data.prompt;
      } catch {
        return reply.status(400).send({
          error: { code: 'INVALID_AUDIO', message: 'Malformed base64 audio encoding' },
        });
      }
    } else if (Buffer.isBuffer(request.body)) {
      audioBuffer = request.body;
      mimeType = (contentType.split(';')[0] || '').trim() || 'audio/webm';
    } else if (request.body instanceof Uint8Array) {
      audioBuffer = Buffer.from(request.body);
      mimeType = (contentType.split(';')[0] || '').trim() || 'audio/webm';
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return reply.status(400).send({
        error: { code: 'INVALID_AUDIO', message: 'Audio payload cannot be empty' },
      });
    }

    try {
      const router = aiService.getRouter();
      const result = await router.transcribe({
        audio: audioBuffer,
        mimeType,
        language,
        prompt,
      });

      return reply.send({
        text: result.text,
        provider: result.providerId,
        model: result.model,
        duration: result.duration,
      });
    } catch (err: any) {
      request.log.error({ err }, 'Voice transcription failed');
      const isRateLimit =
        err.name === 'RateLimitError' ||
        err.code === 'RATE_LIMIT_EXCEEDED' ||
        err.message?.includes('rate limit');
      const statusCode = isRateLimit ? 429 : 503;
      return reply.status(statusCode).send({
        error: {
          code: isRateLimit ? 'RATE_LIMIT_EXCEEDED' : err.code || 'TRANSCRIPTION_FAILED',
          message: err.message || 'Failed to transcribe audio recording',
        },
      });
    }
  });
}
