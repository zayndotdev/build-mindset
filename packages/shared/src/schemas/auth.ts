import { z } from 'zod';

export const LoginRequestSchema = z.object({
  passphrase: z.string().min(1, 'Passphrase is required'),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SetupRequestSchema = z.object({
  passphrase: z.string().min(8, 'Passphrase must be at least 8 characters'),
});

export type SetupRequest = z.infer<typeof SetupRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginResponseSchema = z.object({
  user: AuthUserSchema,
  expiresAt: z.string(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
