import React, { useState } from 'react';
import { Layers, ChevronRight } from 'lucide-react';

interface TopicCard {
  id: string;
  title: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  description: string;
  tags: string[];
  stepsCount: number;
}

const TOPICS_DATA: TopicCard[] = [
  {
    id: 'auth-email-password',
    title: 'Email + Password Authentication',
    category: 'Security & Auth',
    difficulty: 'intermediate',
    estimatedMinutes: 15,
    description: 'Argon2id hashing, timing attack mitigation, secure session tokens, and IETF draft rate limiting.',
    tags: ['Auth', 'Security', 'Argon2id', 'Sessions'],
    stepsCount: 4,
  },
  {
    id: 'db-relational-schema',
    title: 'Relational Schema Design & Indexing',
    category: 'Database & Storage',
    difficulty: 'intermediate',
    estimatedMinutes: 20,
    description: 'PostgreSQL schema modeling, composite B-tree index design, foreign key strategies, and query planning.',
    tags: ['PostgreSQL', 'Indexing', 'Schema', 'SQL'],
    stepsCount: 4,
  },
  {
    id: 'api-restful-design',
    title: 'RESTful API Design & Versioning',
    category: 'API & Microservices',
    difficulty: 'beginner',
    estimatedMinutes: 15,
    description: 'Idempotency patterns, HTTP status codes, standard RateLimit headers, and URL pagination.',
    tags: ['REST', 'HTTP', 'Idempotency', 'API'],
    stepsCount: 4,
  },
  {
    id: 'ai-rag',
    title: 'Retrieval-Augmented Generation Architecture',
    category: 'AI & Systems',
    difficulty: 'advanced',
    estimatedMinutes: 25,
    description: 'Dense vector embeddings, chunking strategies, cosine similarity retrieval, and reranking pipelines.',
    tags: ['RAG', 'Vector DB', 'Embeddings', 'LLM'],
    stepsCount: 4,
  },
];

export const TopicsView: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filteredTopics = selectedFilter === 'all'
    ? TOPICS_DATA
    : TOPICS_DATA.filter((t) => t.difficulty === selectedFilter);

  const getDifficultyBadge = (difficulty: TopicCard['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20';
      case 'intermediate':
        return 'bg-accent-amber/10 text-accent-amber border-accent-amber/20';
      case 'advanced':
        return 'bg-accent-rose/10 text-accent-rose border-accent-rose/20';
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Curriculum Topics</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            4 foundational system engineering challenges with verified rubrics
          </p>
        </div>

        {/* Difficulty Filter */}
        <div className="flex items-center space-x-1.5 self-start sm:self-auto bg-surface-card p-1 rounded-xl border border-surface-border">
          {['all', 'beginner', 'intermediate', 'advanced'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedFilter(lvl)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium capitalize transition-all ${
                selectedFilter === lvl
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Topics List */}
      <div className="grid gap-3 sm:gap-4">
        {filteredTopics.map((topic) => (
          <div
            key={topic.id}
            className="glass-card rounded-2xl p-5 border border-surface-border hover:border-primary-500/40 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-400">
                    {topic.category}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getDifficultyBadge(topic.difficulty)}`}>
                    {topic.difficulty}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1 group-hover:text-primary-300 transition-colors">
                  {topic.title}
                </h3>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all mt-1" />
            </div>

            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {topic.description}
            </p>

            <div className="mt-4 pt-3 border-t border-surface-border/60 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>{topic.stepsCount} steps</span>
                </span>
                <span>•</span>
                <span>~{topic.estimatedMinutes} mins</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {topic.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-surface-card text-[10px] text-slate-400 border border-surface-border"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
