import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  ChevronRight,
  Play,
  X,
  Sparkles,
  Clock,
  Compass,
  Lock,
  BookOpen,
  Search,
  ChevronLeft,
} from 'lucide-react';
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
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'authored' | 'unauthored'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<TopicCard | null>(null);
  const [sessionLevel, setSessionLevel] = useState<'foundation' | 'working' | 'advanced'>('working');
  const [sessionMode, setSessionMode] = useState<'standard' | 'quick'>('standard');
  const [activeSessionTopic, setActiveSessionTopic] = useState<TopicCard | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(9);

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

  // Compute unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [topics]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDifficulty, statusFilter, selectedCategory, pageSize]);

  // Filtered topics
  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const matchesDifficulty = selectedDifficulty === 'all' || t.difficulty === selectedDifficulty;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'authored' && t.referenceStatus === 'authored') ||
        (statusFilter === 'unauthored' && t.referenceStatus === 'unauthored');
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesDifficulty && matchesStatus && matchesCategory && matchesSearch;
    });
  }, [topics, selectedDifficulty, statusFilter, selectedCategory, searchQuery]);

  // Pagination calculation
  const totalItems = filteredTopics.length;
  const effectivePageSize = pageSize === 'all' ? totalItems : pageSize;
  const totalPages = effectivePageSize > 0 ? Math.ceil(totalItems / effectivePageSize) : 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages || 1);

  const paginatedTopics = useMemo(() => {
    if (pageSize === 'all') return filteredTopics;
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredTopics.slice(startIndex, startIndex + pageSize);
  }, [filteredTopics, safeCurrentPage, pageSize]);

  const authoredCount = topics.filter((t) => t.referenceStatus === 'authored').length;
  const roadmapCount = topics.length - authoredCount;

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

  const getDifficultyBadge = (difficulty: TopicCard['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-success-subtle text-success-text border-success-border';
      case 'intermediate':
        return 'bg-warning-subtle text-warning-text border-warning-border';
      case 'advanced':
        return 'bg-danger-subtle text-danger-text border-danger-border';
    }
  };

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * (pageSize === 'all' ? totalItems : pageSize) + 1;
  const endItem = pageSize === 'all' ? totalItems : Math.min(safeCurrentPage * pageSize, totalItems);

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
              Curriculum Topics
            </h1>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-primary-subtle text-primary-text border border-primary-border">
              {topics.length} Total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            <span className="font-semibold text-success-text">{authoredCount} verified rubrics</span> ready for graded practice •{' '}
            <span className="font-medium text-text-muted">{roadmapCount} cataloged in spec roadmap</span>
          </p>
        </div>

        {/* Status Filter Tabs ("All should be visible already" - default is 'all') */}
        <div className="flex items-center bg-surface-subtle p-1 rounded-xl border border-surface-border text-xs shadow-2xs self-start lg:self-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
            }`}
          >
            All Topics ({topics.length})
          </button>
          <button
            onClick={() => setStatusFilter('authored')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
              statusFilter === 'authored'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
            }`}
          >
            <Sparkles className="w-3 h-3 text-warning" />
            <span>Ready to Practice ({authoredCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('unauthored')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              statusFilter === 'unauthored'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
            }`}
          >
            Roadmap ({roadmapCount})
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-surface rounded-2xl p-4 border border-surface-border shadow-soft space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics by title, tag, category, or architecture keywords..."
              className="w-full pl-10 pr-14 py-2.5 rounded-xl bg-surface-subtle border border-surface-border text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted hover:text-text-primary"
              >
                Clear
              </button>
            )}
          </div>

          {/* Difficulty Dropdown / Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-semibold text-text-secondary hidden sm:inline">Level:</span>
            <div className="flex items-center space-x-1 bg-surface-subtle p-1 rounded-xl border border-surface-border text-xs">
              {['all', 'beginner', 'intermediate', 'advanced'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedDifficulty(lvl)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                    selectedDifficulty === lvl
                      ? 'bg-surface text-primary shadow-xs font-bold border border-surface-border'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="shrink-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full md:w-auto px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs font-semibold text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-xs"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Counter & Page Size Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-surface-border text-xs text-text-muted">
          <div>
            Showing <span className="font-bold text-text-primary">{startItem}</span> to{' '}
            <span className="font-bold text-text-primary">{endItem}</span> of{' '}
            <span className="font-bold text-text-primary">{totalItems}</span> matching topics
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-medium text-text-secondary">Topics per page:</span>
            <div className="flex items-center space-x-1 bg-surface-subtle p-0.5 rounded-lg border border-surface-border">
              {([6, 9, 12, 24, 'all'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setPageSize(size)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    pageSize === size
                      ? 'bg-surface text-primary shadow-2xs border border-surface-border'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {size === 'all' ? 'All' : size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Topics Responsive Grid (Desktop 3-column, Tablet 2-column, Mobile 1-column) */}
      {paginatedTopics.length === 0 ? (
        <div className="bg-surface rounded-2xl p-10 border border-surface-border text-center space-y-3">
          <BookOpen className="w-10 h-10 text-text-muted mx-auto" />
          <h3 className="text-base font-bold text-text-primary">No matching curriculum topics</h3>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            Try adjusting your search query, difficulty filters, or switch status to "All Topics".
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDifficulty('all');
              setStatusFilter('all');
              setSelectedCategory('all');
            }}
            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs transition-all"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedTopics.map((topic) => {
            const isAuthored = topic.referenceStatus === 'authored';

            return (
              <div
                key={topic.id}
                onClick={() => setSelectedTopic(topic)}
                className={`rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between group bg-surface shadow-soft hover:shadow-card ${
                  isAuthored
                    ? 'border-surface-border hover:border-primary-border ring-1 ring-transparent hover:ring-primary/10'
                    : 'border-surface-border hover:border-surface-border-strong opacity-95 hover:opacity-100'
                }`}
              >
                <div>
                  {/* Top Metadata Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary truncate">
                      {topic.category}
                    </span>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getDifficultyBadge(topic.difficulty)}`}>
                        {topic.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Topic Title */}
                  <h3 className="text-base font-bold text-text-primary group-hover:text-primary transition-colors leading-snug line-clamp-2">
                    {topic.title}
                  </h3>

                  {/* Topic Description */}
                  <p className="text-xs text-text-secondary mt-2 line-clamp-2 leading-relaxed">
                    {topic.description}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="mt-5 pt-3 border-t border-surface-border space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center space-x-1">
                        <Layers className="w-3.5 h-3.5 text-text-muted" />
                        <span>{topic.stepsCount} steps</span>
                      </span>
                      <span>•</span>
                      <span>~{topic.estimatedMinutes}m</span>
                    </div>

                    {isAuthored ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success-subtle text-success-text border border-success-border">
                        <Sparkles className="w-3 h-3" />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-subtle text-text-muted border border-surface-border">
                        <Lock className="w-3 h-3" />
                        <span>Roadmap</span>
                      </span>
                    )}
                  </div>

                  {/* Interactive Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTopic(topic);
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      isAuthored
                        ? 'bg-primary hover:bg-primary-hover text-white shadow-2xs group-hover:shadow-xs'
                        : 'bg-surface-subtle hover:bg-surface-border text-text-secondary hover:text-text-primary border border-surface-border'
                    }`}
                  >
                    {isAuthored ? (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Start Practice Dialogue</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3 h-3" />
                        <span>View Syllabus Spec</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Pagination Controls (Previous / Page Numbers / Next) */}
      {pageSize !== 'all' && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-surface-border">
          <div className="text-xs text-text-muted">
            Page <span className="font-bold text-text-primary">{safeCurrentPage}</span> of{' '}
            <span className="font-bold text-text-primary">{totalPages}</span> ({totalItems} topics total)
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-surface-border text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {/* Page Number Buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              // Only render nearby pages for clean UX
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= safeCurrentPage - 1 && pageNum <= safeCurrentPage + 1)
              ) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                      safeCurrentPage === pageNum
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary border border-transparent hover:border-surface-border'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              }
              if (pageNum === safeCurrentPage - 2 || pageNum === safeCurrentPage + 2) {
                return (
                  <span key={pageNum} className="text-xs text-text-muted px-1">
                    ...
                  </span>
                );
              }
              return null;
            })}

            {/* Next Button */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-surface-border text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Topic Configuration / Syllabus Modal */}
      {selectedTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-surface-border p-6 shadow-card max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedTopic(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-subtle transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {selectedTopic.referenceStatus === 'authored' ? (
              <>
                <div className="flex items-center space-x-2 text-primary text-xs font-bold mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>Begin Socratic Practice Dialogue</span>
                </div>

                <h3 className="text-xl font-extrabold text-text-primary">{selectedTopic.title}</h3>
                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{selectedTopic.description}</p>

                {/* Level Selector */}
                <div className="mt-5 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Engineering Seniority Level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['foundation', 'working', 'advanced'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSessionLevel(lvl)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition-all ${
                          sessionLevel === lvl
                            ? 'bg-primary border-primary text-white shadow-xs'
                            : 'bg-surface-subtle border-surface-border text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Session Mode Selector */}
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Session Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSessionMode('standard')}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        sessionMode === 'standard'
                          ? 'bg-primary-subtle border-primary text-primary-text'
                          : 'bg-surface-subtle border-surface-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 font-bold text-xs">
                        <Compass className="w-3.5 h-3.5 text-primary" />
                        <span>Standard Mode</span>
                      </div>
                      <div className="text-[11px] text-text-muted mt-1">4 steps + full rubric evaluation</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSessionMode('quick')}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        sessionMode === 'quick'
                          ? 'bg-primary-subtle border-primary text-primary-text'
                          : 'bg-surface-subtle border-surface-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 font-bold text-xs">
                        <Clock className="w-3.5 h-3.5 text-tertiary" />
                        <span>Quick Drill</span>
                      </div>
                      <div className="text-[11px] text-text-muted mt-1">2 steps + mini feedback</div>
                    </button>
                  </div>
                </div>

                {/* Launch Button */}
                <div className="mt-6 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTopic(null)}
                    className="flex-1 py-2.5 rounded-xl border border-surface-border text-text-secondary text-xs font-bold hover:bg-surface-subtle transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSessionTopic(selectedTopic);
                      setSelectedTopic(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/25 inline-flex items-center justify-center space-x-2 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Launch Session</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Roadmap Topic Syllabus Spec View */}
                <div className="flex items-center space-x-2 text-warning-text text-xs font-bold mb-1">
                  <BookOpen className="w-4 h-4 text-warning" />
                  <span>Curriculum Spec Syllabus</span>
                </div>

                <h3 className="text-xl font-extrabold text-text-primary">{selectedTopic.title}</h3>
                <div className="flex items-center space-x-2 text-xs text-text-muted mt-1">
                  <span>{selectedTopic.category}</span>
                  <span>•</span>
                  <span className="capitalize">{selectedTopic.difficulty}</span>
                  <span>•</span>
                  <span>~{selectedTopic.estimatedMinutes} mins</span>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-surface-subtle border border-surface-border text-xs text-text-secondary space-y-3">
                  <p className="leading-relaxed font-medium text-text-primary">
                    {selectedTopic.description}
                  </p>

                  <div className="space-y-1.5">
                    <span className="font-bold text-text-primary block">Architecture Competencies Covered:</span>
                    <ul className="list-disc pl-4 space-y-1 text-text-secondary">
                      <li>Component boundaries, state management, and isolation patterns</li>
                      <li>High availability, failure recovery, and zero-data-loss strategies</li>
                      <li>Latency vs throughput trade-offs in distributed workloads</li>
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-surface-border text-[11px] text-text-muted flex items-center justify-between">
                    <span>Tags: {selectedTopic.tags.map((t) => `#${t}`).join(' ')}</span>
                  </div>
                </div>

                <div className="mt-5 p-3 rounded-xl bg-primary-subtle border border-primary-border text-xs text-primary-text flex items-center justify-between">
                  <span>Ready to practice today? Try one of the 4 verified rubrics!</span>
                  <button
                    onClick={() => {
                      setStatusFilter('authored');
                      setSelectedTopic(null);
                    }}
                    className="font-bold underline ml-2"
                  >
                    Show Ready (4)
                  </button>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedTopic(null)}
                    className="w-full py-2.5 rounded-xl bg-surface-subtle hover:bg-surface-border text-text-primary text-xs font-bold border border-surface-border transition-all"
                  >
                    Close Syllabus
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
