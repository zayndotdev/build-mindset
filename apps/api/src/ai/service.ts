import {
  AIRouter,
  BaseAdapter,
  GeminiAdapter,
  GroqAdapter,
  MistralAdapter,
  CohereAdapter,
  MockAdapter,
} from '@mindset/ai';
import type { ProviderId, ModelInfo } from '@mindset/shared';
import { ProviderRepository } from '../db/repositories/provider.repository';
import { AppEnv } from '../config/env';

export class AIService {
  private router: AIRouter;
  private adapters = new Map<ProviderId, BaseAdapter>();
  private useMockAI: boolean;

  constructor(
    private providerRepo: ProviderRepository,
    private env: AppEnv,
    useMockAI: boolean = false
  ) {
    this.useMockAI = useMockAI || process.env.MOCK_AI === 'true' || env.NODE_ENV === 'test';
    this.router = new AIRouter();
  }

  public getRouter(): AIRouter {
    return this.router;
  }

  public setMockBehavior(providerId: ProviderId, behavior: any): void {
    const adapter = this.adapters.get(providerId);
    if (adapter instanceof MockAdapter) {
      adapter.setBehavior(behavior);
    }
  }

  public async reloadProviders(): Promise<void> {
    await this.providerRepo.ensureDefaultProviders();
    const records = await this.providerRepo.listProviders();

    const priority: ProviderId[] = [];
    let pinnedGraderId: ProviderId = 'gemini';
    let pinnedGraderModel = 'gemini-2.5-flash';

    this.adapters.clear();

    for (const record of records) {
      priority.push(record.id);
      if (record.isGradingPrimary) {
        pinnedGraderId = record.id;
        pinnedGraderModel = record.model;
      }

      const decryptedKey = await this.providerRepo.getDecryptedKey(
        record.id,
        this.env.ENCRYPTION_KEY
      );

      const adapter = this.createAdapter(record.id, record.model, decryptedKey);
      this.adapters.set(record.id, adapter);
    }

    this.router = new AIRouter({
      priority,
      pinnedGraderId,
      pinnedGraderModel,
      rubricVersion: 'v1.0',
    });

    for (const adapter of this.adapters.values()) {
      this.router.registerProvider(adapter);
    }
  }

  public async testProvider(
    id: ProviderId,
    overrideKey?: string
  ): Promise<{ success: boolean; models: ModelInfo[]; error?: string }> {
    const record = await this.providerRepo.getProvider(id);
    if (!record) {
      return { success: false, models: [], error: `Provider ${id} not found` };
    }

    const apiKey =
      overrideKey ?? (await this.providerRepo.getDecryptedKey(id, this.env.ENCRYPTION_KEY));

    if (!apiKey && !this.useMockAI) {
      return { success: false, models: [], error: 'API key is missing' };
    }

    const adapter = this.createAdapter(id, record.model, apiKey ?? 'mock-key');

    try {
      const health = await adapter.healthCheck();
      if (!health.ok) {
        throw new Error(health.error || 'Health check returned false');
      }

      const models = await adapter.listModels();
      await this.providerRepo.recordHealth(id, true, null);

      return { success: true, models };
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Provider connection test failed';
      await this.providerRepo.recordHealth(id, false, errorMsg);
      return { success: false, models: [], error: errorMsg };
    }
  }

  public async listModelsForProvider(id: ProviderId): Promise<ModelInfo[]> {
    const adapter = this.adapters.get(id);
    if (!adapter) return [];

    try {
      return await adapter.listModels();
    } catch {
      return [];
    }
  }

  private createAdapter(
    id: ProviderId,
    model: string,
    apiKey: string | null
  ): BaseAdapter {
    if (this.useMockAI || !apiKey) {
      // In mock mode or when unkeyed, instantiate MockAdapter with provider identity
      return new MockAdapter(id, `Mock ${id.toUpperCase()}`, model);
    }

    switch (id) {
      case 'gemini':
        return new GeminiAdapter(apiKey, model);
      case 'groq':
        return new GroqAdapter(apiKey, model);
      case 'mistral':
        return new MistralAdapter(apiKey, model);
      case 'cohere':
        return new CohereAdapter(apiKey, model);
      default:
        return new MockAdapter(id, `Mock ${id}`, model);
    }
  }
}
