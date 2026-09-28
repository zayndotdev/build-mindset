import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from project root or current working directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // fallback to local

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().default('data/mindset.db'),
  APP_PASSPHRASE: z.string().min(8, 'APP_PASSPHRASE must be at least 8 characters').default('mindset-dev-passphrase-2026'),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)').default(
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  ),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').default(
    'super-secret-session-key-must-be-at-least-32-chars-long'
  ),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((val) => val === '1' || val === 'true'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof EnvSchema>;
export type AppEnv = Env;

let envConfig: Env | null = null;

export function getEnv(): Env {
  if (!envConfig) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error('❌ Invalid environment variables:', parsed.error.format());
      throw new Error('Failed to load configuration. Check environment variables.');
    }
    envConfig = parsed.data;
  }
  return envConfig;
}
