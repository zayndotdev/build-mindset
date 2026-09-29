import { eq, asc, desc } from 'drizzle-orm';
import { AppDatabase } from '../client';
import {
  learningSessions,
  sessionSteps,
  messages,
  skillScores,
  reviewItems,
  englishReports,
} from '../schema';
import { randomUUID } from 'node:crypto';

export interface CreateSessionInput {
  id?: string;
  topicId: string;
  level: string;
  sessionMode: string;
}

export interface AddMessageInput {
  id?: string;
  sessionId: string;
  role: 'user' | 'coach' | 'system';
  content: string;
  voiceTranscriptOriginal?: string;
  modality?: string;
  providerUsed?: string;
  tokensInput?: number;
  tokensOutput?: number;
  stepNumber?: number;
}

export interface RecordStepInput {
  id?: string;
  sessionId: string;
  stepNumber: number;
  stepSlug: string;
  attempts?: number;
  hintsUsed?: number;
  qualityScore?: number;
  independenceScore?: number;
  compositeScore?: number;
  gradeResult?: any;
  graderId?: string;
  rubricVersion?: string;
  isFallbackGrade?: boolean;
  userAnswer?: string;
  coachQuestion?: string;
  modelAnswer?: string;
  teachingResponse?: string;
  providerUsed?: string;
  tokensInput?: number;
  tokensOutput?: number;
  startedAt?: string;
  completedAt?: string;
}

export class SessionRepository {
  constructor(private db: AppDatabase) {}

  async createSession(input: CreateSessionInput) {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();

    await this.db
      .insert(learningSessions)
      .values({
        id,
        topicId: input.topicId,
        state: 'QUESTION',
        level: input.level,
        sessionMode: input.sessionMode,
        startedAt: now,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return this.getSession(id);
  }

  async getSession(id: string) {
    const rows = await this.db
      .select()
      .from(learningSessions)
      .where(eq(learningSessions.id, id))
      .all();

    return rows[0] || null;
  }

  async listRecentSessions(limit = 20) {
    return await this.db
      .select()
      .from(learningSessions)
      .orderBy(desc(learningSessions.createdAt))
      .limit(limit)
      .all();
  }

  async updateSessionState(id: string, state: string, completedAt?: string | null) {
    const now = new Date().toISOString();
    await this.db
      .update(learningSessions)
      .set({
        state,
        ...(completedAt !== undefined && { completedAt }),
        updatedAt: now,
      })
      .where(eq(learningSessions.id, id))
      .run();
  }

  async addMessage(input: AddMessageInput) {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();

    await this.db
      .insert(messages)
      .values({
        id,
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        voiceTranscriptOriginal: input.voiceTranscriptOriginal ?? null,
        modality: input.modality ?? 'text',
        providerUsed: input.providerUsed ?? null,
        tokensInput: input.tokensInput ?? 0,
        tokensOutput: input.tokensOutput ?? 0,
        stepNumber: input.stepNumber ?? null,
        createdAt: now,
      })
      .run();

    return { id, createdAt: now, ...input };
  }

  async getMessages(sessionId: string) {
    return await this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt))
      .all();
  }

  async recordStep(input: RecordStepInput) {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();

    await this.db
      .insert(sessionSteps)
      .values({
        id,
        sessionId: input.sessionId,
        stepNumber: input.stepNumber,
        stepSlug: input.stepSlug,
        attempts: input.attempts ?? 1,
        hintsUsed: input.hintsUsed ?? 0,
        qualityScore: input.qualityScore ?? null,
        independenceScore: input.independenceScore ?? null,
        compositeScore: input.compositeScore ?? null,
        gradeResult: input.gradeResult ?? null,
        graderId: input.graderId ?? null,
        rubricVersion: input.rubricVersion ?? null,
        isFallbackGrade: input.isFallbackGrade ?? false,
        userAnswer: input.userAnswer ?? null,
        coachQuestion: input.coachQuestion ?? null,
        modelAnswer: input.modelAnswer ?? null,
        teachingResponse: input.teachingResponse ?? null,
        providerUsed: input.providerUsed ?? null,
        tokensInput: input.tokensInput ?? null,
        tokensOutput: input.tokensOutput ?? null,
        startedAt: input.startedAt ?? now,
        completedAt: input.completedAt ?? null,
      })
      .run();
  }

  async getSteps(sessionId: string) {
    return await this.db
      .select()
      .from(sessionSteps)
      .where(eq(sessionSteps.sessionId, sessionId))
      .orderBy(asc(sessionSteps.stepNumber))
      .all();
  }

  async recordSkillScore(sessionId: string, dimension: string, score: number) {
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.db
      .insert(skillScores)
      .values({
        id,
        sessionId,
        dimension,
        score,
        recordedAt: now,
      })
      .run();
  }

  async getSkillScores(sessionId: string) {
    return await this.db
      .select()
      .from(skillScores)
      .where(eq(skillScores.sessionId, sessionId))
      .all();
  }

  async recordReviewItem(
    topicId: string,
    stepNumber: number,
    dimension: string,
    state: {
      easeFactor: number;
      intervalDays: number;
      repetitions: number;
      nextDue: string;
      lastQuality?: number;
      lastReviewed?: string;
    }
  ) {
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.db
      .insert(reviewItems)
      .values({
        id,
        topicId,
        stepNumber,
        dimension,
        easeFactor: state.easeFactor,
        intervalDays: state.intervalDays,
        repetitions: state.repetitions,
        nextDue: state.nextDue,
        lastQuality: state.lastQuality ?? null,
        lastReviewed: state.lastReviewed ?? now,
        createdAt: now,
      })
      .run();
  }

  async getDueReviews(now = new Date().toISOString()) {
    const all = await this.db.select().from(reviewItems).all();
    return all.filter((r) => r.nextDue <= now);
  }

  async recordEnglishReport(
    sessionId: string,
    report: {
      corrections: any;
      technicalVocab: any;
      seniorRewrite: any;
      pronunciationNote?: string;
    }
  ) {
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.db
      .insert(englishReports)
      .values({
        id,
        sessionId,
        corrections: report.corrections,
        technicalVocab: report.technicalVocab,
        seniorRewrite: report.seniorRewrite,
        pronunciationNote: report.pronunciationNote ?? null,
        createdAt: now,
      })
      .run();
  }

  async getEnglishReport(sessionId: string) {
    const rows = await this.db
      .select()
      .from(englishReports)
      .where(eq(englishReports.sessionId, sessionId))
      .all();

    return rows[0] || null;
  }
}
