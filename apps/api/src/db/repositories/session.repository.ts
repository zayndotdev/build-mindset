import { eq, asc, desc } from 'drizzle-orm';
import { AppDatabase } from '../client';
import {
  topics,
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

  async getReviewItem(id: string) {
    const rows = await this.db.select().from(reviewItems).where(eq(reviewItems.id, id)).all();
    return rows[0] || null;
  }

  async updateReviewItem(
    id: string,
    state: {
      easeFactor: number;
      intervalDays: number;
      repetitions: number;
      nextDue: string;
      lastQuality: number;
      lastReviewed: string;
    }
  ) {
    await this.db
      .update(reviewItems)
      .set({
        easeFactor: state.easeFactor,
        intervalDays: state.intervalDays,
        repetitions: state.repetitions,
        nextDue: state.nextDue,
        lastQuality: state.lastQuality,
        lastReviewed: state.lastReviewed,
      })
      .where(eq(reviewItems.id, id))
      .run();

    return this.getReviewItem(id);
  }

  async getDueReviewsWithTopics(now = new Date().toISOString()) {
    const allReviews = await this.db.select().from(reviewItems).all();
    const allTopics = await this.db.select().from(topics).all();
    const topicMap = new Map(allTopics.map((t) => [t.id, t]));

    return allReviews
      .map((review) => {
        const topic = topicMap.get(review.topicId);
        let stepTitle = `Step ${review.stepNumber}`;
        let stepPrompt = '';
        if (topic && topic.stepsData) {
          const steps = Array.isArray(topic.stepsData) ? (topic.stepsData as any[]) : [];
          const step = steps.find((s: any) => s.stepNumber === review.stepNumber);
          if (step) {
            stepTitle = step.title || step.stepSlug || stepTitle;
            stepPrompt = step.coachQuestion || step.description || '';
          }
        }
        return {
          ...review,
          topicTitle: topic?.title || review.topicId,
          topicCategory: topic?.category || review.dimension,
          stepTitle,
          stepPrompt,
          isDue: review.nextDue <= now,
        };
      })
      .sort((a, b) => (a.isDue === b.isDue ? a.nextDue.localeCompare(b.nextDue) : a.isDue ? -1 : 1));
  }

  async getReviewStats() {
    const all = await this.db.select().from(reviewItems).all();
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const dueToday = all.filter((r) => r.nextDue <= endOfToday).length;
    const dueThisWeek = all.filter((r) => r.nextDue <= endOfWeek).length;
    const mastered = all.filter((r) => r.repetitions >= 3 && r.easeFactor >= 2.5).length;

    return {
      totalTracked: all.length,
      dueToday,
      dueThisWeek,
      mastered,
    };
  }

  async getProgressOverview() {
    const allSessions = await this.db
      .select()
      .from(learningSessions)
      .orderBy(desc(learningSessions.createdAt))
      .all();

    const completedSessions = allSessions.filter((s) => s.state === 'SESSION_COMPLETED');
    const allSteps = await this.db.select().from(sessionSteps).all();
    const allTopics = await this.db.select().from(topics).all();
    const topicMap = new Map(allTopics.map((t) => [t.id, t]));

    // Quality and Independence calculations
    const stepsWithQuality = allSteps.filter((s) => typeof s.qualityScore === 'number');
    const stepsWithIndep = allSteps.filter((s) => typeof s.independenceScore === 'number');

    const avgQuality =
      stepsWithQuality.length > 0
        ? Math.round((stepsWithQuality.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / stepsWithQuality.length) * 10) / 10
        : 0;

    const avgIndependence =
      stepsWithIndep.length > 0
        ? Math.round((stepsWithIndep.reduce((sum, s) => sum + (s.independenceScore || 0), 0) / stepsWithIndep.length) * 10) / 10
        : 0;

    // Streak calculation
    let streakDays = 0;
    const sessionDates = new Set<string>();
    for (const s of completedSessions) {
      if (s.completedAt || s.startedAt) {
        const d = (s.completedAt || s.startedAt).split('T')[0];
        sessionDates.add(d);
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    const startCheckDate = sessionDates.has(todayStr)
      ? new Date()
      : sessionDates.has(yesterdayStr)
      ? yesterdayDate
      : null;

    if (startCheckDate) {
      const checkDate = new Date(startCheckDate);
      while (true) {
        const str = checkDate.toISOString().split('T')[0];
        if (sessionDates.has(str)) {
          streakDays++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Dimension Radar calculation (QUALITY ONLY per D-016)
    const dimensionBuckets: Record<string, number[]> = {
      problem_framing: [],
      data_modeling: [],
      tradeoffs: [],
      failure_modes: [],
      communication: [],
    };

    for (const step of allSteps) {
      if (typeof step.qualityScore !== 'number') continue;
      const slug = (step.stepSlug || '').toLowerCase();
      if (slug.includes('problem')) {
        dimensionBuckets.problem_framing.push(step.qualityScore);
      } else if (slug.includes('tradeoff')) {
        dimensionBuckets.tradeoffs.push(step.qualityScore);
        dimensionBuckets.data_modeling.push(step.qualityScore);
      } else if (slug.includes('edge') || slug.includes('failure')) {
        dimensionBuckets.failure_modes.push(step.qualityScore);
      } else if (slug.includes('recap') || slug.includes('transfer')) {
        dimensionBuckets.communication.push(step.qualityScore);
      } else {
        dimensionBuckets.problem_framing.push(step.qualityScore);
      }
    }

    const calcBucketAvg = (scores: number[], defaultVal = 3.0) => {
      if (scores.length === 0) return defaultVal;
      return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    };

    const dimensions = [
      { name: 'Problem Framing', slug: 'problem_framing', score: calcBucketAvg(dimensionBuckets.problem_framing, 3.2), max: 4.0 },
      { name: 'Data & Architecture', slug: 'data_modeling', score: calcBucketAvg(dimensionBuckets.data_modeling, 3.0), max: 4.0 },
      { name: 'Tradeoff Evaluation', slug: 'tradeoffs', score: calcBucketAvg(dimensionBuckets.tradeoffs, 3.4), max: 4.0 },
      { name: 'Failure Modes & Edge Cases', slug: 'failure_modes', score: calcBucketAvg(dimensionBuckets.failure_modes, 2.8), max: 4.0 },
      { name: 'Synthesis & Communication', slug: 'communication', score: calcBucketAvg(dimensionBuckets.communication, 3.5), max: 4.0 },
    ];

    // Independence Trend (Separate from Radar per D-016)
    const independenceTrend = allSteps
      .filter((s) => typeof s.independenceScore === 'number')
      .slice(-10)
      .map((s) => {
        const sess = allSessions.find((sess) => sess.id === s.sessionId);
        const top = sess ? topicMap.get(sess.topicId) : null;
        return {
          stepNumber: s.stepNumber,
          independenceScore: s.independenceScore,
          qualityScore: s.qualityScore,
          date: s.completedAt || s.startedAt,
          topicTitle: top?.title || 'Architecture Session',
        };
      });

    // Weak spots: lowest dimensions
    const weakSpots = dimensions
      .filter((d) => d.score < 3.2)
      .map((d) => ({
        dimension: d.name,
        score: d.score,
        recommendation: `Practice topics focusing on ${d.name.toLowerCase()} to improve your recall under pressure.`,
      }));

    return {
      overallReadiness: avgQuality,
      avgQuality,
      avgIndependence,
      totalSessions: allSessions.length,
      completedSessionsCount: completedSessions.length,
      streakDays,
      dimensions,
      independenceTrend,
      weakSpots,
    };
  }

  async getSessionHistory(limit = 30) {
    const allSessions = await this.db
      .select()
      .from(learningSessions)
      .orderBy(desc(learningSessions.createdAt))
      .limit(limit)
      .all();

    const allTopics = await this.db.select().from(topics).all();
    const topicMap = new Map(allTopics.map((t) => [t.id, t]));
    const allSteps = await this.db.select().from(sessionSteps).all();

    return allSessions.map((session) => {
      const topic = topicMap.get(session.topicId);
      const steps = allSteps.filter((s) => s.sessionId === session.id);
      const qualityScores = steps.filter((s) => typeof s.qualityScore === 'number').map((s) => s.qualityScore!);
      const indepScores = steps.filter((s) => typeof s.independenceScore === 'number').map((s) => s.independenceScore!);

      const avgQuality =
        qualityScores.length > 0
          ? Math.round((qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length) * 10) / 10
          : null;
      const avgIndependence =
        indepScores.length > 0
          ? Math.round((indepScores.reduce((a, b) => a + b, 0) / indepScores.length) * 10) / 10
          : null;

      return {
        id: session.id,
        topicId: session.topicId,
        topicTitle: topic?.title || session.topicId,
        category: topic?.category || 'Architecture',
        difficulty: topic?.difficulty || 'Intermediate',
        level: session.level,
        sessionMode: session.sessionMode,
        state: session.state,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        stepsCount: steps.length,
        avgQuality,
        avgIndependence,
      };
    });
  }

  async getSessionWithDetails(id: string) {
    const session = await this.getSession(id);
    if (!session) return null;

    const topicRows = await this.db.select().from(topics).where(eq(topics.id, session.topicId)).all();
    const topic = topicRows[0] || null;
    const steps = await this.getSteps(id);
    const messagesList = await this.getMessages(id);
    const englishReport = await this.getEnglishReport(id);
    const skillScoresList = await this.getSkillScores(id);

    return {
      session,
      topic,
      steps,
      messages: messagesList,
      englishReport,
      skillScores: skillScoresList,
    };
  }
}
