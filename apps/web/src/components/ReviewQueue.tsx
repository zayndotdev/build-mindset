import React, { useState, useEffect } from 'react';
import { RotateCcw, CheckCircle2, Sparkles, X, ChevronRight, Loader2 } from 'lucide-react';

export interface DueReviewItem {
  id: string;
  topicId: string;
  topicTitle: string;
  topicCategory: string;
  stepNumber: number;
  stepTitle: string;
  stepPrompt: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextDue: string;
  lastQuality: number | null;
  lastReviewed: string | null;
  isDue: boolean;
}

export interface ReviewStats {
  totalTracked: number;
  dueToday: number;
  dueThisWeek: number;
  mastered: number;
}

export const ReviewQueue: React.FC = () => {
  const [reviews, setReviews] = useState<DueReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDrillItem, setActiveDrillItem] = useState<DueReviewItem | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const fetchReviewsAndStats = async () => {
    try {
      setIsLoading(true);
      const [dueRes, statsRes] = await Promise.all([
        fetch('/api/v1/reviews/due', { credentials: 'include' }),
        fetch('/api/v1/reviews/stats', { credentials: 'include' }),
      ]);

      if (dueRes.ok) {
        const dueData = await dueRes.json();
        setReviews(dueData.data || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data || null);
      }
    } catch (err) {
      console.error('Failed to load spaced reviews:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewsAndStats();
  }, []);

  const handleRateRecall = async (qualityScore: number) => {
    if (!activeDrillItem) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/v1/reviews/${activeDrillItem.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ quality: qualityScore }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.data;
        setFeedbackMsg(
          `Review recorded! Next review in ${updated.intervalDays} day${updated.intervalDays > 1 ? 's' : ''} (EF: ${updated.easeFactor.toFixed(2)}).`
        );

        setTimeout(() => {
          setFeedbackMsg(null);
          setActiveDrillItem(null);
          setShowAnswer(false);
          fetchReviewsAndStats();
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to submit review answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Review Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="glass-card p-3 rounded-xl border border-surface-border text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Due Today</div>
          <div className="text-xl font-bold text-accent-cyan mt-0.5">{stats ? stats.dueToday : '0'}</div>
        </div>
        <div className="glass-card p-3 rounded-xl border border-surface-border text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Due This Week</div>
          <div className="text-xl font-bold text-primary-400 mt-0.5">{stats ? stats.dueThisWeek : '0'}</div>
        </div>
        <div className="glass-card p-3 rounded-xl border border-surface-border text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Mastered</div>
          <div className="text-xl font-bold text-accent-emerald mt-0.5">{stats ? stats.mastered : '0'}</div>
        </div>
        <div className="glass-card p-3 rounded-xl border border-surface-border text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Tracked</div>
          <div className="text-xl font-bold text-slate-200 mt-0.5">{stats ? stats.totalTracked : '0'}</div>
        </div>
      </div>

      {/* Due Review Cards */}
      <div className="glass-card rounded-2xl p-5 border border-surface-border">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-4 h-4 text-accent-cyan" />
            <h3 className="text-sm font-semibold text-white">SM-2 Spaced Repetition Queue</h3>
          </div>
          <button
            onClick={fetchReviewsAndStats}
            aria-label="Refresh review queue"
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="text-xs">Loading spaced review queue...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-6 rounded-xl bg-surface-card border border-surface-border/60 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-accent-emerald mx-auto" />
            <p className="text-sm font-medium text-white">All caught up!</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No spaced repetition reviews are due right now. Complete active sessions to schedule new recall drills.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {reviews.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-surface-card border border-surface-border hover:border-surface-border/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-white">{item.topicTitle}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      Step {item.stepNumber}: {item.stepTitle}
                    </span>
                    {item.isDue ? (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
                        Due Now
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-500">
                        Due in {item.intervalDays}d
                      </span>
                    )}
                  </div>
                  {item.stepPrompt && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{item.stepPrompt}</p>
                  )}
                  <div className="flex items-center space-x-3 text-[10px] text-slate-500 mt-1.5 font-mono">
                    <span>Reps: {item.repetitions}</span>
                    <span>Interval: {item.intervalDays}d</span>
                    <span>EF: {item.easeFactor.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveDrillItem(item);
                    setShowAnswer(false);
                    setFeedbackMsg(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-colors flex items-center justify-center space-x-1 shrink-0"
                >
                  <span>Practice Drill</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Drill Modal */}
      {activeDrillItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drill-title"
        >
          <div className="glass-panel border border-surface-border rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setActiveDrillItem(null)}
              aria-label="Close drill modal"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2 text-xs text-primary-400 font-semibold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Spaced Repetition Recall Drill</span>
              </div>
              <h3 id="drill-title" className="text-lg font-bold text-white mt-1">
                {activeDrillItem.topicTitle} · Step {activeDrillItem.stepNumber}
              </h3>
              <p className="text-xs text-slate-400">{activeDrillItem.stepTitle}</p>
            </div>

            {/* Prompt Box */}
            <div className="p-4 rounded-xl bg-surface-card border border-surface-border/80 space-y-2">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Socratic Question
              </span>
              <p className="text-sm text-slate-200 font-medium leading-relaxed">
                {activeDrillItem.stepPrompt || 'Explain the core architectural tradeoffs and edge cases for this step.'}
              </p>
            </div>

            {/* Answer / Key Points Section */}
            <div>
              {!showAnswer ? (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-primary-500/40 text-primary-400 hover:bg-primary-500/5 text-xs font-semibold transition-colors flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Reveal Key Points & Self-Evaluation</span>
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-primary-950/20 border border-primary-500/30 space-y-2 animate-fade-in">
                  <div className="text-xs font-semibold text-primary-300">Target Architectural Concept</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Verify whether your recall covered the essential tradeoffs: memory-hardness, algorithmic time bounds, graceful fallbacks, and concurrency race conditions.
                  </p>
                </div>
              )}
            </div>

            {/* Self-Rating Feedback Buttons (SM-2 Quality 1-4) */}
            {showAnswer && (
              <div className="space-y-2 pt-2 border-t border-surface-border/60 animate-fade-in">
                <span className="text-[11px] font-semibold text-slate-300">
                  How well did you recall this concept?
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleRateRecall(1)}
                    className="p-2.5 rounded-xl bg-accent-rose/10 hover:bg-accent-rose/20 text-accent-rose border border-accent-rose/20 text-center transition-colors disabled:opacity-50"
                  >
                    <div className="text-xs font-bold">1: Forgot</div>
                    <div className="text-[9px] opacity-80 mt-0.5">Reset to 1d</div>
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleRateRecall(2)}
                    className="p-2.5 rounded-xl bg-accent-amber/10 hover:bg-accent-amber/20 text-accent-amber border border-accent-amber/20 text-center transition-colors disabled:opacity-50"
                  >
                    <div className="text-xs font-bold">2: Hard</div>
                    <div className="text-[9px] opacity-80 mt-0.5">Struggled</div>
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleRateRecall(3)}
                    className="p-2.5 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/20 text-center transition-colors disabled:opacity-50"
                  >
                    <div className="text-xs font-bold">3: Good</div>
                    <div className="text-[9px] opacity-80 mt-0.5">Solid recall</div>
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleRateRecall(4)}
                    className="p-2.5 rounded-xl bg-accent-emerald/10 hover:bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/20 text-center transition-colors disabled:opacity-50"
                  >
                    <div className="text-xs font-bold">4: Easy</div>
                    <div className="text-[9px] opacity-80 mt-0.5">Instant recall</div>
                  </button>
                </div>
              </div>
            )}

            {/* Notification message */}
            {feedbackMsg && (
              <div className="p-3 rounded-xl bg-accent-emerald/10 border border-accent-emerald/20 text-accent-emerald text-xs text-center font-medium animate-fade-in">
                {feedbackMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
