# Contributing & Extensibility Guide — Mindset

> Guidelines for extending Mindset: adding curriculum topics, authoring evaluation key points, adding AI providers, and development conventions.

---

## 1. Development Conventions

- **Monorepo Tooling**: `pnpm` workspaces with Turborepo (`pnpm-workspace.yaml`).
- **Language**: TypeScript in strict mode (`"strict": true`, no implicit `any`).
- **Commit Format**: Conventional Commits:
  - `feat(...)`: New user-facing capability or API endpoint
  - `fix(...)`: Bug fix
  - `docs(...)`: Documentation updates
  - `test(...)`: New or updated tests
  - `chore(...)`: Dependency updates or build tooling
- **Testing Standard**: Every new API endpoint or business logic function must be accompanied by unit or integration tests in Vitest. Target ≥80% coverage on new code.

---

## 2. How to Add a New Curriculum Topic

The curriculum catalog resides in `packages/learning/src/curriculum/catalog.ts`.

### Step 1: Define Topic Structure
Each topic adheres to the `TopicSchema` Zod validation:
```typescript
{
  id: "cache-write-behind",
  title: "Write-Behind (Write-Back) Caching",
  description: "Asynchronous database writes via write-behind queue for high-throughput mutation workloads.",
  category: "caching",
  level: 2,
  standardSteps: [1, 5, 8, 9], // Recommended steps for 4-step standard session
  referenceStatus: "authored", // "authored" allows graded sessions; "unauthored" blocks graded sessions
  steps: [
    {
      stepIndex: 1,
      name: "Problem Clarification & Write SLA",
      objective: "Define write consistency tolerance, acceptable data loss window, and peak ingestion QPS.",
      referenceKeyPoints: [
        { text: "Clarifies eventual consistency window and acceptable RPO", isCore: true },
        { text: "Identifies queue durability requirements (Kafka/RabbitMQ/Redis Streams)", isCore: true },
        { text: "Considers read-your-own-writes consistency", isCore: false }
      ],
      modelAnswer: "For a write-behind pattern, we accept eventual consistency between the cache and the primary DB...",
      hints: [
        "What happens if a user writes and immediately refreshes to read their update?",
        "Consider using a durable write-ahead log or Redis Streams before acknowledging writes."
      ]
    },
    // Add additional steps (e.g. 5, 8, 9)
  ]
}
```

### Step 2: Seed the Database
Run the seed script to persist new topics into SQLite:
```bash
pnpm seed
```

### Step 3: Run Topic Verification Tests
```bash
pnpm --filter learning test
```

---

## 3. How to Add an AI Provider Adapter

Mindset uses a unified adapter interface in `@mindset/ai`.

### Step 1: Implement `ProviderAdapter`
In `packages/ai/src/providers/`:
```typescript
import { ProviderAdapter, ProviderMessage, ModelCapabilities } from '../types';

export class CustomProviderAdapter implements ProviderAdapter {
  id = 'custom-provider' as const;
  name = 'Custom AI Provider';

  constructor(private apiKey: string, private baseUrl?: string) {}

  async generate(messages: ProviderMessage[], options?: any): Promise<ProviderResponse> {
    // Implement API call
  }

  async *stream(messages: ProviderMessage[], options?: any): AsyncIterable<string> {
    // Yield tokens as received
  }

  async testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    // Ping model list or lightweight generation
  }

  async listModels(): Promise<string[]> {
    // Query provider's live models endpoint
  }
}
```

### Step 2: Register in `AIRouter`
Register the new provider in `packages/ai/src/router/ai-router.ts`.

### Step 3: Add Mock Tests
Create a corresponding test in `packages/ai/tests/` verifying standard generation, streaming, and error handling with simulated responses.
