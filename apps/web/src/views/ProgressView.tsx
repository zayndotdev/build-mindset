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
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
            Competency & Mastery
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
            Architectural rubric scores, Socratic independence progression, and spaced recall
          </p>
        </div>

        {/* Tab Controls */}
        <div
          className="flex items-center p-1 rounded-xl bg-surface-subtle border border-surface-border self-start sm:self-auto shadow-2xs"
          role="tablist"
          aria-label="Progress navigation tabs"
        >
          <button
            role="tab"
            aria-selected={subTab === 'overview'}
            onClick={() => setSubTab('overview')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === 'overview'
                ? 'bg-surface text-primary shadow-xs border border-surface-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Skill Radar & Metrics</span>
            </div>
          </button>

          <button
            role="tab"
            aria-selected={subTab === 'reviews'}
            onClick={() => setSubTab('reviews')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === 'reviews'
                ? 'bg-surface text-primary shadow-xs border border-surface-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Spaced Reviews</span>
            </div>
          </button>

          <button
            role="tab"
            aria-selected={subTab === 'history'}
            onClick={() => setSubTab('history')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === 'history'
                ? 'bg-surface text-primary shadow-xs border border-surface-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Session History</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-text-secondary bg-surface rounded-3xl border border-surface-border shadow-soft">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm font-semibold">Analyzing Socratic Rubric Telemetry...</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-danger-subtle border border-danger-border text-danger-text text-xs space-y-3">
              <p className="font-bold text-sm">Unable to load progress data.</p>
              <p>{error}</p>
              <button
                onClick={fetchOverview}
                className="px-4 py-2 rounded-xl bg-danger text-white font-bold transition-all shadow-xs"
              >
                Retry Request
              </button>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Overall Readiness & Streak Hero Banner */}
              <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-surface-border shadow-soft">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black uppercase tracking-wider text-primary">
                        Overall Engineering Readiness
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-primary-subtle text-primary-text border border-primary-border">
                        L5 Senior Evaluated
                      </span>
                    </div>

                    <div className="flex items-baseline space-x-3">
                      <span className="text-4xl sm:text-5xl font-black text-text-primary tracking-tight">
                        {data.overallReadiness.toFixed(1)}
                      </span>
                      <span className="text-base text-text-muted font-normal">/ 4.0</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                      <div className="flex items-center space-x-1.5 text-primary font-bold">
                        <Flame className="w-4 h-4 fill-primary text-primary" />
                        <span>{data.streakDays} Day Practice Streak</span>
                      </div>
                      <span className="text-surface-border">•</span>
                      <span className="text-text-secondary font-semibold">
                        {data.completedSessionsCount} Completed Socratic Session{data.completedSessionsCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Dual Metric KPI Badges */}
                  <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
                    <div className="p-4 rounded-2xl bg-surface-subtle border border-surface-border">
                      <div className="text-[11px] font-bold text-text-secondary">Answer Quality</div>
                      <div className="text-xl sm:text-2xl font-black text-text-primary mt-1">
                        {data.avgQuality.toFixed(1)} <span className="text-xs text-text-muted font-normal">/ 4.0</span>
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">Depth, accuracy & trade-offs</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface-subtle border border-surface-border">
                      <div className="text-[11px] font-bold text-text-secondary">Independence</div>
                      <div className="text-xl sm:text-2xl font-black text-success-text mt-1">
                        {data.avgIndependence.toFixed(1)} <span className="text-xs text-text-muted font-normal">/ 4.0</span>
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">Hint ladder minimization</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2-Column Responsive Dashboard Layout on Desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column (lg:col-span-7): Skill Radar & Breakdown */}
                <div className="lg:col-span-7 bg-surface rounded-3xl p-6 sm:p-7 border border-surface-border shadow-soft space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                    <div>
                      <h3 className="text-base font-extrabold text-text-primary tracking-tight">
                        Competency Radar (Quality Scores)
                      </h3>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Factual accuracy, architectural depth, trade-off evaluations, and edge cases.
                      </p>
                    </div>
                    <button
                      onClick={fetchOverview}
                      title="Refresh metrics"
                      className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-primary-subtle border border-transparent hover:border-primary-border transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Render the redesigned radar chart */}
                  <SkillRadarChart dimensions={data.dimensions} showBreakdown={true} />
                </div>

                {/* Right Column (lg:col-span-5): Independence Trend & Growth Areas */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Independence Trend */}
                  <div className="bg-surface rounded-3xl p-6 sm:p-7 border border-surface-border shadow-soft">
                    <IndependenceTrend trend={data.independenceTrend} />
                  </div>

                  {/* Identified Growth Areas */}
                  {data.weakSpots && data.weakSpots.length > 0 && (
                    <div className="bg-surface rounded-3xl p-6 sm:p-7 border border-surface-border shadow-soft space-y-3">
                      <div className="flex items-center space-x-2 text-warning-text pb-2 border-b border-surface-border">
                        <ShieldAlert className="w-4 h-4 text-warning" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                          Coaching Focus & Growth Areas
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {data.weakSpots.map((ws, i) => (
                          <div
                            key={`weakspot-${i}`}
                            className="p-4 rounded-xl bg-warning-subtle/50 border border-warning-border/60 flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-text-primary block">{ws.dimension}</span>
                              <p className="text-xs text-text-secondary leading-relaxed">{ws.recommendation}</p>
                            </div>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-warning-subtle text-warning-text border border-warning-border shrink-0">
                              {ws.score.toFixed(1)} / 4.0
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {subTab === 'reviews' && <ReviewQueue />}

      {subTab === 'history' && <SessionHistory />}
    </div>
  );
};
