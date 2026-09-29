import { eq } from 'drizzle-orm';
import { AppDatabase } from '../client';
import { topics } from '../schema';
import type { Topic } from '@mindset/shared';

export class TopicRepository {
  constructor(private db: AppDatabase) {}

  async seedTopic(topicData: Topic): Promise<void> {
    const existing = await this.db.select().from(topics).where(eq(topics.id, topicData.id)).all();
    const now = new Date().toISOString();

    if (existing.length === 0) {
      await this.db.insert(topics).values({
        id: topicData.id,
        title: topicData.title,
        category: topicData.category,
        difficulty: topicData.difficulty,
        standardSteps: topicData.standardSteps,
        prerequisites: topicData.prerequisites ?? [],
        learningObjectives: topicData.learningObjectives,
        keyTradeoffs: topicData.keyTradeoffs,
        commonPitfalls: topicData.commonPitfalls,
        transferTopicId: topicData.transferTopicId,
        transferPrompt: topicData.transferPrompt,
        estimatedMinutes: topicData.estimatedMinutes,
        tags: topicData.tags,
        isCustom: topicData.isCustom ?? false,
        isActive: topicData.isActive ?? true,
        referenceStatus: topicData.referenceStatus ?? 'authored',
        stepsData: JSON.stringify(topicData.steps),
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }

  async listTopics(): Promise<Array<Omit<Topic, 'steps'>>> {
    const rows = await this.db.select().from(topics).all();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      difficulty: r.difficulty as Topic['difficulty'],
      standardSteps: r.standardSteps,
      prerequisites: r.prerequisites,
      learningObjectives: r.learningObjectives,
      keyTradeoffs: r.keyTradeoffs,
      commonPitfalls: r.commonPitfalls,
      transferTopicId: r.transferTopicId,
      transferPrompt: r.transferPrompt,
      estimatedMinutes: r.estimatedMinutes,
      tags: r.tags,
      isCustom: r.isCustom,
      isActive: r.isActive,
      referenceStatus: (r.referenceStatus as Topic['referenceStatus']) ?? 'authored',
    }));
  }

  async getTopicById(id: string): Promise<Topic | null> {
    const rows = await this.db.select().from(topics).where(eq(topics.id, id)).all();
    const r = rows[0];
    if (!r) return null;

    return {
      id: r.id,
      title: r.title,
      category: r.category,
      difficulty: r.difficulty as Topic['difficulty'],
      standardSteps: r.standardSteps,
      prerequisites: r.prerequisites,
      learningObjectives: r.learningObjectives,
      keyTradeoffs: r.keyTradeoffs,
      commonPitfalls: r.commonPitfalls,
      transferTopicId: r.transferTopicId,
      transferPrompt: r.transferPrompt,
      estimatedMinutes: r.estimatedMinutes,
      tags: r.tags,
      isCustom: r.isCustom,
      isActive: r.isActive ?? true,
      referenceStatus: (r.referenceStatus as Topic['referenceStatus']) ?? 'authored',
      steps: typeof r.stepsData === 'string' ? JSON.parse(r.stepsData) : (r.stepsData as unknown as Topic['steps']),
    };
  }
}
