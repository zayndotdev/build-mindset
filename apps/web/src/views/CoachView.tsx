import React from 'react';
import {
  Mic,
  Sparkles,
  Clock,
  ShieldCheck,
  Flame,
  ArrowRight,
  Trophy,
  Zap,
  CheckCircle2,
  Compass,
  Database,
  Layers,
  Cpu,
} from 'lucide-react';

interface CoachViewProps {
  onNavigateToTopics: () => void;
}

const FEATURED_PRACTICE_TRACKS = [
  {
    id: 'auth-email-password',
    title: 'Email + Password Authentication',
    category: 'Security & Auth',
    icon: ShieldCheck,
    difficulty: 'Intermediate',
    time: '15 mins',
    steps: 4,
    description: 'Argon2id hashing, timing attack mitigation, secure session tokens, and IETF draft rate limiting.',
    tags: ['Auth', 'Security', 'Argon2id'],
  },
  {
    id: 'db-relational-schema',
    title: 'Relational Schema Design & Indexing',
    category: 'Database & Storage',
    icon: Database,
    difficulty: 'Intermediate',
    time: '20 mins',
    steps: 4,
    description: 'PostgreSQL schema modeling, composite B-tree index design, foreign key strategies, and query planning.',
    tags: ['PostgreSQL', 'Indexing', 'Schema'],
  },
  {
    id: 'api-restful-design',
    title: 'RESTful API Design & Versioning',
    category: 'API & Microservices',
    icon: Layers,
    difficulty: 'Beginner',
    time: '15 mins',
    steps: 4,
    description: 'Idempotency patterns, HTTP status codes, standard RateLimit headers, and URL pagination.',
    tags: ['REST', 'HTTP', 'API'],
  },
  {
    id: 'ai-rag',
    title: 'Retrieval-Augmented Generation (RAG)',
    category: 'AI & Systems',
    icon: Cpu,
    difficulty: 'Advanced',
    time: '25 mins',
    steps: 4,
    description: 'Dense vector embeddings, chunking strategies, cosine similarity retrieval, and reranking pipelines.',
    tags: ['RAG', 'Vector DB', 'LLM'],
  },
];

export const CoachView: React.FC<CoachViewProps> = ({ onNavigateToTopics }) => {
  return (
    <div className="space-y-8 pb-16 animate-fade-in">
      {/* Hero Executive Command Header */}
      <div className="relative overflow-hidden rounded-3xl bg-surface border border-surface-border p-6 sm:p-8 lg:p-10 shadow-soft">
        {/* Soft background ambient gradient glows */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-primary-border/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Vision & Action */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-primary-subtle border border-primary-border text-primary-text text-xs font-bold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Voice-First System Design & Architecture Coach</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-text-primary tracking-tight leading-[1.15]">
              Master architectural trade-offs <span className="text-primary">out loud</span>.
            </h1>

            <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl">
              Real-time Socratic dialogue tailored for senior and staff engineers.
              Articulate technical decisions, defend trade-offs, and receive structured rubric feedback on clarity, failure modes, and independence.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={onNavigateToTopics}
                className="inline-flex items-center space-x-2.5 px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] transition-all"
              >
                <Mic className="w-4 h-4" />
                <span>Browse All Curriculum Topics (50)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onNavigateToTopics}
                className="inline-flex items-center space-x-2 px-4 py-3 rounded-xl bg-surface hover:bg-surface-subtle border border-surface-border text-text-primary text-sm font-semibold transition-all hover:border-surface-border-strong shadow-2xs"
              >
                <Zap className="w-4 h-4 text-warning" />
                <span>Quick Daily Workout (15 min)</span>
              </button>
            </div>

            {/* Trust Badges */}
            <div className="pt-3 flex flex-wrap items-center gap-5 text-xs text-text-muted">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>4 Verified Socratic Rubrics</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>46 In Spec Roadmap</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>L5–L7 Staff Caliber Evaluation</span>
              </div>
            </div>
          </div>

          {/* Right Column: Daily Focus Spotlight Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-surface-subtle p-5 sm:p-6 border border-surface-border shadow-soft relative overflow-hidden group hover:border-primary-border transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-primary">
                  <Compass className="w-4 h-4 text-primary" />
                  <span>Recommended Focus</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-warning-subtle text-warning-text border border-warning-border">
                  Intermediate
                </span>
              </div>

              <h2 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors">
                Email + Password Authentication
              </h2>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                Argon2id memory parameters, timing attack mitigation, secure HttpOnly session tokens, and draft IETF rate limiting.
              </p>

              <div className="mt-4 pt-3 border-t border-surface-border grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center space-x-1.5 text-text-muted">
                  <Clock className="w-3.5 h-3.5 text-text-secondary" />
                  <span>~15 min dialogue</span>
                </div>
                <div className="flex items-center space-x-1.5 text-text-muted">
                  <Layers className="w-3.5 h-3.5 text-text-secondary" />
                  <span>4 Guided Steps</span>
                </div>
              </div>

              <button
                onClick={onNavigateToTopics}
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold inline-flex items-center justify-center space-x-2 shadow-xs transition-all"
              >
                <span>Launch Socratic Session</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Overview - 4-Column Metric Grid on Desktop */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-text-muted">
              Engineering Activity & Resilience
            </span>
          </div>
          <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-surface-subtle text-text-secondary border border-surface-border">
            Live Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Practice Streak */}
          <div className="bg-surface rounded-2xl p-5 border border-surface-border shadow-soft flex items-center space-x-4 hover:border-primary-border transition-all">
            <div className="p-3 rounded-xl bg-primary-subtle text-primary border border-primary-border/60 shrink-0">
              <Flame className="w-6 h-6 fill-primary text-primary" />
            </div>
            <div>
              <div className="text-xs text-text-muted font-semibold">Practice Streak</div>
              <div className="text-2xl font-black text-text-primary tracking-tight mt-0.5">3 Days</div>
              <div className="text-[11px] text-primary font-bold mt-0.5">Consistent daily pacing</div>
            </div>
          </div>

          {/* Card 2: Time Practiced */}
          <div className="bg-surface rounded-2xl p-5 border border-surface-border shadow-soft flex items-center space-x-4 hover:border-primary-border transition-all">
            <div className="p-3 rounded-xl bg-tertiary-subtle text-tertiary border border-tertiary-border/60 shrink-0">
              <Clock className="w-6 h-6 text-tertiary" />
            </div>
            <div>
              <div className="text-xs text-text-muted font-semibold">Time Practiced</div>
              <div className="text-2xl font-black text-text-primary tracking-tight mt-0.5">42 mins</div>
              <div className="text-[11px] text-text-muted font-medium mt-0.5">Across 4 evaluated sessions</div>
            </div>
          </div>

          {/* Card 3: Socratic Independence */}
          <div className="bg-surface rounded-2xl p-5 border border-surface-border shadow-soft flex items-center space-x-4 hover:border-primary-border transition-all">
            <div className="p-3 rounded-xl bg-success-subtle text-success-text border border-success-border/60 shrink-0">
              <ShieldCheck className="w-6 h-6 text-success" />
            </div>
            <div>
              <div className="text-xs text-text-muted font-semibold">Independence</div>
              <div className="text-2xl font-black text-text-primary tracking-tight mt-0.5">
                3.4 <span className="text-xs text-text-muted font-normal">/ 4.0</span>
              </div>
              <div className="text-[11px] text-success-text font-bold mt-0.5">L5 Senior • Minimal hints</div>
            </div>
          </div>

          {/* Card 4: Architecture Mastery */}
          <div className="bg-surface rounded-2xl p-5 border border-surface-border shadow-soft flex items-center space-x-4 hover:border-primary-border transition-all">
            <div className="p-3 rounded-xl bg-primary-subtle text-primary border border-primary-border/60 shrink-0">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-xs text-text-muted font-semibold">Verified Topics</div>
              <div className="text-2xl font-black text-text-primary tracking-tight mt-0.5">
                4 <span className="text-xs text-text-muted font-normal">Ready</span>
              </div>
              <div className="text-[11px] text-primary-text font-bold mt-0.5">46 cataloged in roadmap</div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Practice Tracks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-base font-extrabold text-text-primary tracking-tight">Verified Architecture Tracks</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Fully authored with multi-step reference rubrics, Socratic hints, and model answers
            </p>
          </div>
          <button
            onClick={onNavigateToTopics}
            className="text-xs font-bold text-primary hover:text-primary-hover flex items-center space-x-1 transition-colors"
          >
            <span>View All (50)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURED_PRACTICE_TRACKS.map((track) => {
            const Icon = track.icon;
            return (
              <div
                key={track.id}
                onClick={onNavigateToTopics}
                className="bg-surface rounded-2xl p-5 border border-surface-border hover:border-primary-border shadow-soft hover:shadow-card transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-surface-subtle text-text-secondary group-hover:text-primary group-hover:bg-primary-subtle transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        track.difficulty === 'Beginner'
                          ? 'bg-success-subtle text-success-text border-success-border'
                          : track.difficulty === 'Intermediate'
                          ? 'bg-warning-subtle text-warning-text border-warning-border'
                          : 'bg-danger-subtle text-danger-text border-danger-border'
                      }`}
                    >
                      {track.difficulty}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    {track.category}
                  </span>
                  <h3 className="text-sm font-bold text-text-primary mt-1 group-hover:text-primary transition-colors leading-snug">
                    {track.title}
                  </h3>
                  <p className="text-xs text-text-secondary mt-2 line-clamp-2 leading-relaxed">
                    {track.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-surface-border flex items-center justify-between text-xs text-text-muted">
                  <span>{track.steps} steps • ~{track.time}</span>
                  <span className="text-primary font-bold group-hover:translate-x-0.5 transition-transform flex items-center space-x-1">
                    <span>Practice</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
