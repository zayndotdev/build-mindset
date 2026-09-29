import React from 'react';
import { HelpCircle } from 'lucide-react';

export interface IndependenceTrendPoint {
  stepNumber: number;
  independenceScore: number;
  qualityScore: number | null;
  date: string | null;
  topicTitle: string;
}

interface IndependenceTrendProps {
  trend: IndependenceTrendPoint[];
}

export const IndependenceTrend: React.FC<IndependenceTrendProps> = ({ trend }) => {
  const getScoreBadge = (score: number) => {
    switch (score) {
      case 4:
        return {
          label: 'Unassisted (4/4)',
          bg: 'bg-accent-emerald/10',
          text: 'text-accent-emerald',
          border: 'border-accent-emerald/20',
        };
      case 3:
        return {
          label: '1 Hint (3/4)',
          bg: 'bg-primary-500/10',
          text: 'text-primary-400',
          border: 'border-primary-500/20',
        };
      case 2:
        return {
          label: '2 Hints (2/4)',
          bg: 'bg-accent-amber/10',
          text: 'text-accent-amber',
          border: 'border-accent-amber/20',
        };
      default:
        return {
          label: 'Skipped (0/4)',
          bg: 'bg-accent-rose/10',
          text: 'text-accent-rose',
          border: 'border-accent-rose/20',
        };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-semibold text-slate-300">Independence Score Progression</span>
          <div className="group relative cursor-pointer" tabIndex={0} role="button" aria-label="Independence score explanation">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-200" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block group-focus:block w-56 p-2 rounded-lg bg-surface-card border border-surface-border text-[11px] text-slate-300 shadow-xl z-20">
              Tracks how independently you solved problems without leaning on hints (4 = no hints, 3 = 1 hint, 2 = 2 hints, 0 = skipped). Kept strictly separate from answer quality per ADR-002.
            </div>
          </div>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">Last {trend.length} steps</span>
      </div>

      {/* Visual step blocks */}
      {trend.length === 0 ? (
        <div className="p-4 rounded-xl bg-surface-card border border-surface-border/60 text-center">
          <p className="text-xs text-slate-400">Complete standard steps to view your independence trajectory.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {trend.slice(-4).map((pt, idx) => {
              const badge = getScoreBadge(pt.independenceScore);
              return (
                <div
                  key={`trend-${idx}-${pt.date}`}
                  className="p-2.5 rounded-xl bg-surface-card border border-surface-border/80 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">Step {pt.stepNumber}</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                      {pt.independenceScore}/4
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-[11px] font-semibold text-white truncate" title={pt.topicTitle}>
                      {pt.topicTitle}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Quality: {pt.qualityScore !== null ? `${pt.qualityScore.toFixed(1)}/4.0` : 'N/A'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scale Legend */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-slate-400 border-t border-surface-border/60">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-accent-emerald" />
              <span>4: Unassisted</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-primary-400" />
              <span>3: 1 Hint</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-accent-amber" />
              <span>2: 2 Hints</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-accent-rose" />
              <span>0: Skipped</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
