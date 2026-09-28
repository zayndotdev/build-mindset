import { getDb } from './client';

export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credential (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  passphrase_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_auth (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  hashed_token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT
);

CREATE TABLE IF NOT EXISTS provider_config (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  priority INTEGER NOT NULL,
  is_grading_primary INTEGER NOT NULL DEFAULT 0,
  api_key_encrypted TEXT,
  is_healthy INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_stat (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  stat_date TEXT NOT NULL,
  requests_count INTEGER NOT NULL DEFAULT 0,
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topic (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  standard_steps TEXT NOT NULL,
  prerequisites TEXT NOT NULL DEFAULT '[]',
  learning_objectives TEXT NOT NULL,
  key_tradeoffs TEXT NOT NULL,
  common_pitfalls TEXT NOT NULL,
  transfer_topic_id TEXT NOT NULL,
  transfer_prompt TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  tags TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  steps_data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_session (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topic(id),
  state TEXT NOT NULL,
  level TEXT NOT NULL,
  session_mode TEXT NOT NULL DEFAULT 'standard',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_step (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES learning_session(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_slug TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  hints_used INTEGER NOT NULL DEFAULT 0,
  quality_score REAL,
  independence_score INTEGER,
  composite_score REAL,
  grade_result TEXT,
  grader_id TEXT,
  rubric_version TEXT,
  is_fallback_grade INTEGER DEFAULT 0,
  user_answer TEXT,
  coach_question TEXT,
  model_answer TEXT,
  teaching_response TEXT,
  provider_used TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS message (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES learning_session(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  voice_transcript_original TEXT,
  modality TEXT NOT NULL DEFAULT 'text',
  provider_used TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  step_number INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_score (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES learning_session(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  score REAL NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_item (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topic(id),
  step_number INTEGER NOT NULL,
  dimension TEXT NOT NULL,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 1,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_due TEXT NOT NULL,
  last_quality INTEGER,
  last_reviewed TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS english_report (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES learning_session(id) ON DELETE CASCADE,
  corrections TEXT NOT NULL,
  technical_vocab TEXT NOT NULL,
  senior_rewrite TEXT NOT NULL,
  pronunciation_note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS english_mistake (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  example_original TEXT NOT NULL,
  example_corrected TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_key (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  response_headers TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_auth_token ON session_auth(hashed_token);
CREATE INDEX IF NOT EXISTS idx_learning_session_topic ON learning_session(topic_id);
CREATE INDEX IF NOT EXISTS idx_session_step_session ON session_step(session_id);
CREATE INDEX IF NOT EXISTS idx_message_session ON message(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_score_dimension ON skill_score(dimension);
CREATE INDEX IF NOT EXISTS idx_review_item_due ON review_item(next_due);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_key(expires_at);
`;

export function runMigrations(db = getDb()): void {
  const sqlite = db.$client;
  sqlite.exec(MIGRATION_SQL);
}

// When run directly as a script
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  console.log('Running database migrations...');
  runMigrations();
  console.log('Database migrations completed successfully.');
}
