import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const credentials = sqliteTable('credential', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  passphraseHash: text('passphrase_hash').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessionsAuth = sqliteTable('session_auth', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  hashedToken: text('hashed_token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
});

export const providerConfigs = sqliteTable('provider_config', {
  id: text('id').primaryKey(), // 'gemini' | 'groq' | 'mistral' | 'cohere'
  model: text('model').notNull(),
  priority: integer('priority').notNull(),
  isGradingPrimary: integer('is_grading_primary', { mode: 'boolean' }).notNull().default(false),
  apiKeyEncrypted: text('api_key_encrypted'),
  isHealthy: integer('is_healthy', { mode: 'boolean' }).notNull().default(true),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const usageStats = sqliteTable('usage_stat', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  statDate: text('stat_date').notNull(),
  requestsCount: integer('requests_count').notNull().default(0),
  tokensInput: integer('tokens_input').notNull().default(0),
  tokensOutput: integer('tokens_output').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const topics = sqliteTable('topic', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  difficulty: text('difficulty').notNull(),
  standardSteps: text('standard_steps', { mode: 'json' }).$type<number[]>().notNull(),
  prerequisites: text('prerequisites', { mode: 'json' }).$type<string[]>().notNull().default([]),
  learningObjectives: text('learning_objectives', { mode: 'json' }).$type<string[]>().notNull(),
  keyTradeoffs: text('key_tradeoffs', { mode: 'json' }).$type<string[]>().notNull(),
  commonPitfalls: text('common_pitfalls', { mode: 'json' }).$type<string[]>().notNull(),
  transferTopicId: text('transfer_topic_id').notNull(),
  transferPrompt: text('transfer_prompt').notNull(),
  estimatedMinutes: integer('estimated_minutes').notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  referenceStatus: text('reference_status').notNull().default('authored'),
  stepsData: text('steps_data', { mode: 'json' }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const learningSessions = sqliteTable('learning_session', {
  id: text('id').primaryKey(),
  topicId: text('topic_id')
    .notNull()
    .references(() => topics.id),
  state: text('state').notNull(),
  level: text('level').notNull(),
  sessionMode: text('session_mode').notNull().default('standard'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessionSteps = sqliteTable('session_step', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => learningSessions.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  stepSlug: text('step_slug').notNull(),
  attempts: integer('attempts').notNull().default(1),
  hintsUsed: integer('hints_used').notNull().default(0),
  qualityScore: real('quality_score'),
  independenceScore: integer('independence_score'),
  compositeScore: real('composite_score'),
  gradeResult: text('grade_result', { mode: 'json' }),
  graderId: text('grader_id'),
  rubricVersion: text('rubric_version'),
  isFallbackGrade: integer('is_fallback_grade', { mode: 'boolean' }).default(false),
  userAnswer: text('user_answer'),
  coachQuestion: text('coach_question'),
  modelAnswer: text('model_answer'),
  teachingResponse: text('teaching_response'),
  providerUsed: text('provider_used'),
  tokensInput: integer('tokens_input'),
  tokensOutput: integer('tokens_output'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
});

export const messages = sqliteTable('message', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => learningSessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'coach' | 'system'
  content: text('content').notNull(),
  voiceTranscriptOriginal: text('voice_transcript_original'),
  modality: text('modality').notNull().default('text'),
  providerUsed: text('provider_used'),
  tokensInput: integer('tokens_input'),
  tokensOutput: integer('tokens_output'),
  stepNumber: integer('step_number'),
  createdAt: text('created_at').notNull(),
});

export const skillScores = sqliteTable('skill_score', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => learningSessions.id, { onDelete: 'cascade' }),
  dimension: text('dimension').notNull(),
  score: real('score').notNull(), // Quality score (0-4) for this dimension
  recordedAt: text('recorded_at').notNull(),
});

export const reviewItems = sqliteTable('review_item', {
  id: text('id').primaryKey(),
  topicId: text('topic_id')
    .notNull()
    .references(() => topics.id),
  stepNumber: integer('step_number').notNull(),
  dimension: text('dimension').notNull(),
  easeFactor: real('ease_factor').notNull().default(2.5),
  intervalDays: integer('interval_days').notNull().default(1),
  repetitions: integer('repetitions').notNull().default(0),
  nextDue: text('next_due').notNull(),
  lastQuality: integer('last_quality'),
  lastReviewed: text('last_reviewed'),
  createdAt: text('created_at').notNull(),
});

export const englishReports = sqliteTable('english_report', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => learningSessions.id, { onDelete: 'cascade' }),
  corrections: text('corrections', { mode: 'json' }).notNull(),
  technicalVocab: text('technical_vocab', { mode: 'json' }).notNull(),
  seniorRewrite: text('senior_rewrite', { mode: 'json' }).notNull(),
  pronunciationNote: text('pronunciation_note'),
  createdAt: text('created_at').notNull(),
});

export const englishMistakes = sqliteTable('english_mistake', {
  id: text('id').primaryKey(),
  pattern: text('pattern').notNull(),
  exampleOriginal: text('example_original').notNull(),
  exampleCorrected: text('example_corrected').notNull(),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  firstSeen: text('first_seen').notNull(),
  lastSeen: text('last_seen').notNull(),
});

export const settings = sqliteTable('setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const auditLogs = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  action: text('action').notNull(),
  details: text('details'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull(),
});

export const idempotencyKeys = sqliteTable('idempotency_key', {
  key: text('key').primaryKey(),
  requestHash: text('request_hash').notNull(),
  responseStatus: integer('response_status').notNull(),
  responseBody: text('response_body').notNull(),
  responseHeaders: text('response_headers', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
});
