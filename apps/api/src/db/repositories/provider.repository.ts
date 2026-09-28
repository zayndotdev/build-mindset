import { eq, asc } from 'drizzle-orm';
import { AppDatabase } from '../client';
import { providerConfigs } from '../schema';
import type { ProviderId } from '@mindset/shared';
import { encryptApiKey, decryptApiKey } from '@mindset/shared';

export interface ProviderRecord {
  id: ProviderId;
  model: string;
  priority: number;
  isGradingPrimary: boolean;
  hasKey: boolean;
  isHealthy: boolean;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ProviderRepository {
  constructor(private db: AppDatabase) {}

  async ensureDefaultProviders(): Promise<void> {
    const defaults: Array<{
      id: ProviderId;
      model: string;
      priority: number;
      isGradingPrimary: boolean;
    }> = [
      { id: 'gemini', model: 'gemini-2.5-flash', priority: 1, isGradingPrimary: true },
      { id: 'groq', model: 'llama-3.3-70b-versatile', priority: 2, isGradingPrimary: false },
      { id: 'mistral', model: 'mistral-small-latest', priority: 3, isGradingPrimary: false },
      { id: 'cohere', model: 'command-r7b-12-2024', priority: 4, isGradingPrimary: false },
    ];

    const now = new Date().toISOString();
    for (const d of defaults) {
      const existing = await this.db
        .select()
        .from(providerConfigs)
        .where(eq(providerConfigs.id, d.id))
        .all();

      if (existing.length === 0) {
        await this.db
          .insert(providerConfigs)
          .values({
            id: d.id,
            model: d.model,
            priority: d.priority,
            isGradingPrimary: d.isGradingPrimary,
            apiKeyEncrypted: null,
            isHealthy: true,
            lastError: null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    }
  }

  async listProviders(): Promise<ProviderRecord[]> {
    await this.ensureDefaultProviders();
    const rows = await this.db
      .select()
      .from(providerConfigs)
      .orderBy(asc(providerConfigs.priority))
      .all();

    return rows.map((r) => ({
      id: r.id as ProviderId,
      model: r.model,
      priority: r.priority,
      isGradingPrimary: r.isGradingPrimary,
      hasKey: Boolean(r.apiKeyEncrypted),
      isHealthy: r.isHealthy,
      lastError: r.lastError,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getProvider(id: ProviderId): Promise<ProviderRecord | null> {
    await this.ensureDefaultProviders();
    const rows = await this.db
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.id, id))
      .all();

    const r = rows[0];
    if (!r) return null;

    return {
      id: r.id as ProviderId,
      model: r.model,
      priority: r.priority,
      isGradingPrimary: r.isGradingPrimary,
      hasKey: Boolean(r.apiKeyEncrypted),
      isHealthy: r.isHealthy,
      lastError: r.lastError,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async updateApiKey(id: ProviderId, plainKey: string, hexEncryptionKey: string): Promise<void> {
    await this.ensureDefaultProviders();
    const encrypted = encryptApiKey(plainKey, hexEncryptionKey);
    const now = new Date().toISOString();

    await this.db
      .update(providerConfigs)
      .set({
        apiKeyEncrypted: encrypted,
        isHealthy: true,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(providerConfigs.id, id))
      .run();
  }

  async deleteApiKey(id: ProviderId): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(providerConfigs)
      .set({
        apiKeyEncrypted: null,
        updatedAt: now,
      })
      .where(eq(providerConfigs.id, id))
      .run();
  }

  async getDecryptedKey(id: ProviderId, hexEncryptionKey: string): Promise<string | null> {
    const rows = await this.db
      .select({ apiKeyEncrypted: providerConfigs.apiKeyEncrypted })
      .from(providerConfigs)
      .where(eq(providerConfigs.id, id))
      .all();

    const encrypted = rows[0]?.apiKeyEncrypted;
    if (!encrypted) return null;

    try {
      return decryptApiKey(encrypted, hexEncryptionKey);
    } catch {
      return null;
    }
  }

  async updateConfig(
    id: ProviderId,
    updates: { model?: string; priority?: number; isGradingPrimary?: boolean }
  ): Promise<void> {
    await this.ensureDefaultProviders();
    const now = new Date().toISOString();

    // If setting isGradingPrimary to true, clear it on all others first
    if (updates.isGradingPrimary === true) {
      await this.db
        .update(providerConfigs)
        .set({ isGradingPrimary: false, updatedAt: now })
        .run();
    }

    await this.db
      .update(providerConfigs)
      .set({
        ...(updates.model !== undefined && { model: updates.model }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
        ...(updates.isGradingPrimary !== undefined && { isGradingPrimary: updates.isGradingPrimary }),
        updatedAt: now,
      })
      .where(eq(providerConfigs.id, id))
      .run();
  }

  async recordHealth(id: ProviderId, isHealthy: boolean, lastError: string | null = null): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(providerConfigs)
      .set({
        isHealthy,
        lastError,
        updatedAt: now,
      })
      .where(eq(providerConfigs.id, id))
      .run();
  }
}
