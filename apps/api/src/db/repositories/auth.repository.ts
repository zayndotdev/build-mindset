import { eq } from 'drizzle-orm';
import { AppDatabase } from '../client';
import { users, credentials, sessionsAuth } from '../schema';
import { randomUUID } from 'node:crypto';

export class AuthRepository {
  constructor(private db: AppDatabase) {}

  async ensureUserExists(initialPassphraseHash: string): Promise<{ userId: string }> {
    const existingUsers = await this.db.select().from(users).all();

    if (existingUsers.length > 0 && existingUsers[0]) {
      return { userId: existingUsers[0].id };
    }

    const userId = randomUUID();
    const now = new Date().toISOString();

    await this.db.insert(users).values({
      id: userId,
      createdAt: now,
      updatedAt: now,
    }).run();

    await this.db.insert(credentials).values({
      id: randomUUID(),
      userId,
      passphraseHash: initialPassphraseHash,
      createdAt: now,
      updatedAt: now,
    }).run();

    return { userId };
  }

  async getUser(): Promise<{ id: string; createdAt: string } | null> {
    const rows = await this.db.select().from(users).all();
    return rows[0] ? { id: rows[0].id, createdAt: rows[0].createdAt } : null;
  }

  async getCredential(): Promise<{ passphraseHash: string } | null> {
    const rows = await this.db.select().from(credentials).all();
    return rows[0] ? { passphraseHash: rows[0].passphraseHash } : null;
  }

  async createSession(
    userId: string,
    hashedToken: string,
    expiresAt: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    await this.db.insert(sessionsAuth).values({
      id: randomUUID(),
      userId,
      hashedToken,
      expiresAt,
      createdAt: new Date().toISOString(),
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
    }).run();
  }

  async getSessionByHashedToken(hashedToken: string): Promise<{ id: string; userId: string; expiresAt: string; hashedToken: string } | null> {
    const rows = await this.db.select().from(sessionsAuth).where(eq(sessionsAuth.hashedToken, hashedToken)).all();
    return rows[0] ?? null;
  }

  async deleteSession(hashedToken: string): Promise<void> {
    await this.db.delete(sessionsAuth).where(eq(sessionsAuth.hashedToken, hashedToken)).run();
  }

  async deleteAllSessions(): Promise<void> {
    await this.db.delete(sessionsAuth).run();
  }

  async resetCredentials(): Promise<void> {
    await this.deleteAllSessions();
    await this.db.delete(credentials).run();
    await this.db.delete(users).run();
  }
}
