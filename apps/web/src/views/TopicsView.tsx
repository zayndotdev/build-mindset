import React, { useState, useEffect } from 'react';
import { Layers, ChevronRight, Play, X, Sparkles, Clock, Compass, Lock, BookOpen, Search } from 'lucide-react';
import { ActiveSessionView } from './ActiveSessionView';

interface TopicCard {
  id: string;
  title: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  description: string;
  tags: string[];
  stepsCount: number;
  referenceStatus?: 'authored' | 'unauthored';
}

const FALLBACK_TOPICS: TopicCard[] = [
  {
    id: 'auth-email-password',
    title: 'Email + Password Authentication',
    category: 'Security & Auth',
    difficulty: 'intermediate',
    estimatedMinutes: 15,
    description: 'Argon2id hashing, timing attack mitigation, secure session tokens, and IETF draft rate limiting.',
    tags: ['Auth', 'Security', 'Argon2id', 'Sessions'],
    stepsCount: 4,
    referenceStatus: 'authored',
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
    referenceStatus: 'authored',
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
    referenceStatus: 'authored',
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
    referenceStatus: 'authored',
  },
];

export const TopicsView: React.FC = () => {
  const [topics, setTopics] = useState<TopicCard[]>(FALLBACK_TOPICS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'authored' | 'unauthored'>('all');
  const [selectedTopic, setSelectedTopic] = useState<TopicCard | null>(null);
  const [sessionLevel, setSessionLevel] = useState<'foundation' | 'working' | 'advanced'>('working');
  const [sessionMode, setSessionMode] = useState<'standard' | 'quick'>('standard');
  const [activeSessionTopic, setActiveSessionTopic] = useState<TopicCard | null>(null);

  useEffect(() => {
    fetch('/api/v1/topics', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.topics && Array.isArray(data.topics) && data.topics.length > 0) {
          const mapped: TopicCard[] = data.topics.map((t: any) => ({
            id: t.id,
            title: t.title,
            category: t.category,
            difficulty: t.difficulty,
            estimatedMinutes: t.estimatedMinutes || 15,
            description: t.learningObjectives?.[0] || t.title,
            tags: t.tags || [],
            stepsCount: t.standardSteps?.length || 4,
            referenceStatus: t.referenceStatus || 'unauthored',
          }));
          setTopics(mapped);
        }
      })
      .catch(() => {
        // Retain fallback topics
      });
  }, []);

  if (activeSessionTopic) {
    return (
      <ActiveSessionView
        topicId={activeSessionTopic.id}
        topicTitle={activeSessionTopic.title}
        level={sessionLevel}
        sessionMode={sessionMode}
        onExit={() => setActiveSessionTopic(null)}
      />
    );
  }

  const filteredTopics = topics.filter((t) => {
    const matchesDifficulty = selectedFilter === 'all' || t.difficulty === selectedFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'authored' && t.referenceStatus === 'authored') ||
      (statusFilter === 'unauthored' && t.referenceStatus === 'unauthored');
    const matchesSearch =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesDifficulty && matchesStatus && matchesSearch;
  });

  const authoredCount = topics.filter((t) => t.referenceStatus === 'authored').length;

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
          <h2 className="text-xl font-bold text-white tracking-tight">Curriculum Topics ({topics.length})</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {authoredCount} verified rubrics ready for graded socratic practice • {topics.length - authoredCount} cataloged in spec roadmap
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics by title, tag, or category..."
            className="w-full pl-10 pr-14 py-2.5 rounded-xl bg-surface-card border border-surface-border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center space-x-1 bg-surface-card p-1 rounded-xl border border-surface-border text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'all' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({topics.length})
            </button>
            <button
              onClick={() => setStatusFilter('authored')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'authored' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ready ({authoredCount})
            </button>
            <button
              onClick={() => setStatusFilter('unauthored')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'unauthored' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Roadmap ({topics.length - authoredCount})
            </button>
          </div>

          {/* Difficulty Filter */}
          <div className="flex items-center space-x-1 bg-surface-card p-1 rounded-xl border border-surface-border text-xs">
            {['all', 'beginner', 'intermediate', 'advanced'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedFilter(lvl)}
                className={`px-2 py-1 rounded-lg font-medium capitalize transition-all ${
                  selectedFilter === lvl
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Topics List */}
      <div className="grid gap-3 sm:gap-4">
        {filteredTopics.map((topic) => {
          const isAuthored = topic.referenceStatus === 'authored';

          return (
            <div
              key={topic.id}
              onClick={() => setSelectedTopic(topic)}
              className={`glass-card rounded-2xl p-5 border transition-all cursor-pointer group ${
                isAuthored
                  ? 'border-surface-border hover:border-primary-500/50 hover:bg-surface-card/60'
                  : 'border-surface-border/60 opacity-80 hover:opacity-100 hover:border-surface-border'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-400">
                      {topic.category}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getDifficultyBadge(topic.difficulty)}`}>
                      {topic.difficulty}
                    </span>
                    <span className="text-slate-600">•</span>
                    {isAuthored ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30">
                        <Sparkles className="w-3 h-3" />
                        <span>Ready to Practice</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        <Lock className="w-3 h-3" />
                        <span>Spec Roadmap</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white mt-1.5 group-hover:text-primary-300 transition-colors">
                    {topic.title}
                  </h3>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all mt-1 flex-shrink-0" />
              </div>

              <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-2">
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
          );
        })}
      </div>

      {/* Start Session Configuration Modal */}
      {selectedTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl glass-card border border-surface-border p-6 shadow-2xl bg-surface-card/95">
            <button
              onClick={() => setSelectedTopic(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-card transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {selectedTopic.referenceStatus === 'authored' ? (
              <>
                <div className="flex items-center space-x-2 text-primary-400 text-xs font-semibold mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>Begin Socratic Practice</span>
                </div>

                <h3 className="text-lg font-bold text-white">{selectedTopic.title}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{selectedTopic.description}</p>

                {/* Level Selector */}
                <div className="mt-5 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Experience Level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['foundation', 'working', 'advanced'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSessionLevel(lvl)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border transition-all ${
                          sessionLevel === lvl
                            ? 'bg-primary-600 border-primary-500 text-white shadow-md'
                            : 'bg-surface-card border-surface-border text-slate-400 hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Session Mode Selector */}
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Session Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSessionMode('standard')}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        sessionMode === 'standard'
                          ? 'bg-primary-600/20 border-primary-500 text-white'
                          : 'bg-surface-card border-surface-border text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 font-bold text-xs">
                        <Compass className="w-3.5 h-3.5 text-primary-400" />
                        <span>Standard Mode</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">4 steps + recap</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSessionMode('quick')}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        sessionMode === 'quick'
                          ? 'bg-primary-600/20 border-primary-500 text-white'
                          : 'bg-surface-card border-surface-border text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 font-bold text-xs">
                        <Clock className="w-3.5 h-3.5 text-accent-cyan" />
                        <span>Quick Mode</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">2 steps + mini transfer</div>
                    </button>
                  </div>
                </div>

                {/* Launch Button */}
                <div className="mt-6 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTopic(null)}
                    className="flex-1 py-2.5 rounded-xl border border-surface-border text-slate-300 text-xs font-semibold hover:bg-surface-card transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSessionTopic(selectedTopic);
                      setSelectedTopic(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white text-xs font-semibold shadow-lg shadow-primary-500/25 inline-flex items-center justify-center space-x-2 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Practice</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2 text-accent-amber text-xs font-semibold mb-1">
                  <BookOpen className="w-4 h-4" />
                  <span>Curriculum Roadmap Topic</span>
                </div>

                <h3 className="text-lg font-bold text-white">{selectedTopic.title}</h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {selectedTopic.description}
                </p>

                <div className="mt-4 p-3.5 rounded-xl bg-surface-card border border-surface-border/80 text-xs text-slate-400 space-y-2">
                  <div className="flex items-center space-x-1.5 text-slate-200 font-semibold">
                    <Lock className="w-3.5 h-3.5 text-accent-amber" />
                    <span>Graded Sessions Locked</span>
                  </div>
                  <p>
                    Per the Phase 4 specification, this topic is fully cataloged in the curriculum metadata (learning objectives, key tradeoffs, and common pitfalls), but graded Socratic practice is blocked until reference key points and model answers are authored.
                  </p>
                  <p className="text-primary-400">
                    Switch to one of the 4 fully verified topics (Authentication, Relational Schema, RESTful Design, RAG Architecture) to practice today.
                  </p>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedTopic(null)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-surface-border transition-all"
                  >
                    Understood
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
