import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  History,
  BarChart3,
  Flame,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { SkillRadarChart, RadarDimension } from '../components/SkillRadarChart';
import { IndependenceTrend, IndependenceTrendPoint } from '../components/IndependenceTrend';
import { ReviewQueue } from '../components/ReviewQueue';
import { SessionHistory } from '../components/SessionHistory';

interface ProgressOverviewData {
  overallReadiness: number;
  avgQuality: number;
  avgIndependence: number;
  totalSessions: number;
  completedSessionsCount: number;
  streakDays: number;
  dimensions: RadarDimension[];
  independenceTrend: IndependenceTrendPoint[];
  weakSpots: Array<{
    dimension: string;
    score: number;
    recommendation: string;
  }>;
}

type ProgressSubTab = 'overview' | 'reviews' | 'history';

export const ProgressView: React.FC = () => {
  const [subTab, setSubTab] = useState<ProgressSubTab>('overview');
  const [data, setData] = useState<ProgressOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/v1/progress/overview', { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Failed to load progress data: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message || 'Failed to load progress');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Competency Progress</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Architectural mastery, Socratic independence trends, and spaced recall
          </p>
        </div>

        {/* Tab Controls */}
        <div
          className="flex items-center p-1 rounded-xl bg-surface-card border border-surface-border self-start sm:self-auto"
          role="tablist"
          aria-label="Progress navigation tabs"
        >
          <button
            role="tab"
            aria-selected={subTab === 'overview'}
            onClick={() => setSubTab('overview')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              subTab === 'overview'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Radar & Trend</span>
            </div>
          </button>
          <button
            role="tab"
            aria-selected={subTab === 'reviews'}
            onClick={() => setSubTab('reviews')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              subTab === 'reviews'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reviews</span>
            </div>
          </button>
          <button
            role="tab"
            aria-selected={subTab === 'history'}
            onClick={() => setSubTab('history')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              subTab === 'history'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              <span className="text-xs font-medium">Calculating competency scores...</span>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs space-y-2">
              <p className="font-semibold">Unable to load progress data.</p>
              <button
                onClick={fetchOverview}
                className="px-3 py-1.5 rounded-lg bg-accent-rose/20 hover:bg-accent-rose/30 font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              {/* Overall Readiness & Streak Hero Banner */}
              <div className="glass-card rounded-2xl p-6 border border-surface-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary-400">
                        Overall Architecture Readiness
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
                        Evaluated Quality
                      </span>
                    </div>

                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-4xl font-extrabold text-white">
                        {data.overallReadiness.toFixed(1)}
                      </span>
                      <span className="text-sm text-slate-400 font-normal">/ 4.0</span>
                    </div>

                    {/* Streak Badge */}
                    <div className="flex items-center space-x-3 text-xs mt-2">
                      <div className="flex items-center space-x-1 text-accent-amber font-semibold">
                        <Flame className="w-4 h-4 fill-accent-amber" />
                        <span>
                          {data.streakDays} Day{data.streakDays !== 1 ? 's' : ''} Streak
                        </span>
                      </div>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400 font-medium">
                        {data.completedSessionsCount} Completed Session
                        {data.completedSessionsCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Dual Metric Indicator (Quality vs Independence per D-016) */}
                  <div className="bg-surface-card px-5 py-3 rounded-xl border border-surface-border flex items-center space-x-5">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Quality Score</div>
                      <div className="text-sm font-bold text-accent-cyan mt-0.5">
                        {data.avgQuality.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">/ 4.0</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Depth & Accuracy</div>
                    </div>
                    <div className="w-px h-10 bg-surface-border" />
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Independence</div>
                      <div className="text-sm font-bold text-accent-emerald mt-0.5">
                        {data.avgIndependence.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">/ 4.0</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Hint Minimization</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Skill Radar Chart Card */}
              <div className="glass-card rounded-2xl p-6 border border-surface-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Skill Radar (Quality Scores Only)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Evaluated on factual accuracy, depth, tradeoffs, and edge-case thinking against reference key points.
                    </p>
                  </div>
                  <button
                    onClick={fetchOverview}
                    aria-label="Refresh progress metrics"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="py-2">
                  <SkillRadarChart dimensions={data.dimensions} size={300} />
                </div>
              </div>

              {/* Independence Trend */}
              <div className="glass-card rounded-2xl p-5 border border-surface-border">
                <IndependenceTrend trend={data.independenceTrend} />
              </div>

              {/* Weak Spots & Coaching Recommendations */}
              {data.weakSpots && data.weakSpots.length > 0 && (
                <div className="glass-card rounded-2xl p-5 border border-surface-border space-y-3">
                  <div className="flex items-center space-x-2 text-accent-amber">
                    <ShieldAlert className="w-4 h-4" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider">
                      Identified Growth Areas
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {data.weakSpots.map((ws, i) => (
                      <div
                        key={`weakspot-${i}`}
                        className="p-3 rounded-xl bg-surface-card border border-surface-border/80 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-white">{ws.dimension}</span>
                          <p className="text-xs text-slate-400">{ws.recommendation}</p>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20 shrink-0">
                          {ws.score.toFixed(1)} / 4.0
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {subTab === 'reviews' && <ReviewQueue />}

      {subTab === 'history' && <SessionHistory />}
    </div>
  );
};
