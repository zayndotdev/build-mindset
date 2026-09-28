import React from 'react';
import { Mic, Sparkles, BookOpen, Clock, ShieldCheck, Flame, ArrowRight } from 'lucide-react';

interface CoachViewProps {
  onNavigateToTopics: () => void;
}

export const CoachView: React.FC<CoachViewProps> = ({ onNavigateToTopics }) => {
  return (
    <div className="space-y-6 pb-20">
      {/* Hero Welcome Card */}
      <div className="relative overflow-hidden rounded-2xl glass-card p-6 border border-surface-border">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-accent-cyan/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive AI Socratic Coach</span>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">
            Ready to sharpen your architectural thinking?
          </h2>
          <p className="text-slate-400 text-sm mt-2 max-w-xl leading-relaxed">
            Practice real-world system design and technical leadership decisions out loud.
            Get evaluated on clarity, architectural tradeoffs, and engineering independence.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={onNavigateToTopics}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white text-sm font-semibold shadow-lg shadow-primary-500/25 transition-all"
            >
              <Mic className="w-4 h-4" />
              <span>Browse Curriculum Topics</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Daily Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="glass-card p-4 rounded-xl border border-surface-border flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-accent-amber/10 text-accent-amber">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Practice Streak</div>
            <div className="text-lg font-bold text-white mt-0.5">3 Days</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-surface-border flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-primary-500/10 text-primary-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Time Practiced</div>
            <div className="text-lg font-bold text-white mt-0.5">42 mins</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-surface-border flex items-center space-x-3 col-span-2 sm:col-span-1">
          <div className="p-2.5 rounded-lg bg-accent-emerald/10 text-accent-emerald">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Avg Independence</div>
            <div className="text-lg font-bold text-white mt-0.5">3.4 / 4.0</div>
          </div>
        </div>
      </div>

      {/* Suggested Topic Card */}
      <div className="glass-card p-5 rounded-2xl border border-surface-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-primary-400" />
            <h3 className="text-sm font-semibold text-white">Recommended Next Topic</h3>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20">
            Intermediate
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-card border border-surface-border/80">
          <h4 className="text-base font-bold text-white">Email + Password Authentication</h4>
          <p className="text-xs text-slate-400 mt-1">
            Argon2id hashing, timing-safe verification, secure HttpOnly session tokens, rate limiting.
          </p>

          <div className="mt-4 flex items-center justify-between pt-3 border-t border-surface-border/60">
            <span className="text-xs text-slate-400">4 standard steps · ~15 mins</span>
            <button
              onClick={onNavigateToTopics}
              className="text-xs font-semibold text-primary-400 hover:text-primary-300 flex items-center space-x-1"
            >
              <span>View Topic</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
