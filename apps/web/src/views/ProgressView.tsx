import { TrendingUp, RotateCcw } from 'lucide-react';

export const ProgressView: React.FC = () => {
  const dimensions = [
    { name: 'Problem Framing', score: 3.5, max: 4.0 },
    { name: 'Data Design & Modeling', score: 3.2, max: 4.0 },
    { name: 'Tradeoff Evaluation', score: 3.8, max: 4.0 },
    { name: 'Edge Case Identification', score: 2.9, max: 4.0 },
    { name: 'Communication & Conciseness', score: 3.6, max: 4.0 },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Competency Progress</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track your architectural depth and engineering independence trends
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
          Placeholder UI / Demo Data
        </span>
      </div>

      {/* Main Readiness Gauge */}
      <div className="glass-card rounded-2xl p-6 border border-surface-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary-400">
                Overall Architecture Readiness
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface-card text-slate-400 border border-surface-border">
                Demo
              </span>
            </div>
            <div className="text-3xl font-extrabold text-white mt-1">3.4 <span className="text-base text-slate-400 font-normal">/ 4.0</span></div>
            <div className="flex items-center space-x-1 text-xs text-accent-emerald mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+0.4 increase this week</span>
            </div>
          </div>

          <div className="bg-surface-card px-4 py-3 rounded-xl border border-surface-border flex items-center space-x-4">
            <div>
              <div className="text-[11px] text-slate-400">Quality Score</div>
              <div className="text-sm font-bold text-white mt-0.5">3.5 avg</div>
            </div>
            <div className="w-px h-8 bg-surface-border" />
            <div>
              <div className="text-[11px] text-slate-400">Independence</div>
              <div className="text-sm font-bold text-white mt-0.5">3.3 avg</div>
            </div>
          </div>
        </div>

        {/* Dimension Bars */}
        <div className="mt-6 space-y-3.5 pt-5 border-t border-surface-border/60">
          {dimensions.map((dim) => {
            const percentage = (dim.score / dim.max) * 100;
            return (
              <div key={dim.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{dim.name}</span>
                  <span className="text-white font-semibold">{dim.score.toFixed(1)} / 4.0</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-card overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-cyan"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SM-2 Spaced Repetition Due Queue */}
      <div className="glass-card rounded-2xl p-5 border border-surface-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-4 h-4 text-accent-cyan" />
            <h3 className="text-sm font-semibold text-white">SM-2 Spaced Review Queue</h3>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface-card text-slate-400 border border-surface-border">
              Mock Preview
            </span>
          </div>
          <span className="text-xs text-slate-400">2 items due today</span>
        </div>

        <div className="space-y-2.5">
          <div className="p-3 rounded-xl bg-surface-card border border-surface-border/80 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-white">B-Tree vs Hash Indexing Tradeoffs</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Relational Schema Design · Step 2</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
              Due Now
            </span>
          </div>

          <div className="p-3 rounded-xl bg-surface-card border border-surface-border/80 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-white">Idempotency-Key Header Handling</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">RESTful API Design · Step 3</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
              Due Today
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
