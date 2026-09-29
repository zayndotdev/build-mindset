import React, { useState, useEffect } from 'react';
import { History, ChevronRight, X, Sparkles, BookOpen, Clock, Loader2 } from 'lucide-react';

export interface SessionHistoryItem {
  id: string;
  topicId: string;
  topicTitle: string;
  category: string;
  difficulty: string;
  level: string;
  sessionMode: string;
  state: string;
  startedAt: string;
  completedAt: string | null;
  stepsCount: number;
  avgQuality: number | null;
  avgIndependence: number | null;
}

export interface SessionDetails {
  session: any;
  topic: any;
  steps: any[];
  messages: any[];
  englishReport: any;
  skillScores: any[];
}

export const SessionHistory: React.FC = () => {
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/v1/progress/history', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load session history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleOpenDetails = async (id: string) => {
    setSelectedSessionId(id);
    setSessionDetails(null);
    setIsLoadingDetails(true);

    try {
      const res = await fetch(`/api/v1/progress/sessions/${id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSessionDetails(data.data);
      }
    } catch (err) {
      console.error('Failed to load session details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 border border-surface-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-primary-400" />
            <h3 className="text-sm font-semibold text-white">Session History & Transcripts</h3>
          </div>
          <span className="text-xs text-slate-400">{history.length} sessions</span>
        </div>

        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="text-xs">Loading past sessions...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="p-6 rounded-xl bg-surface-card border border-surface-border/60 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-medium text-white">No completed sessions yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Start an architecture dialogue from the Coach tab to begin building your session record and learning transcript.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.map((sess) => (
              <div
                key={sess.id}
                onClick={() => handleOpenDetails(sess.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleOpenDetails(sess.id);
                  }
                }}
                className="p-3.5 rounded-xl bg-surface-card border border-surface-border hover:border-primary-500/40 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-white group-hover:text-primary-300 transition-colors">
                      {sess.topicTitle}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {sess.level}
                    </span>
                    <span className="text-[10px] capitalize px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400">
                      {sess.sessionMode}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                    <span>{formatDate(sess.startedAt)}</span>
                    <span>·</span>
                    <span>{sess.stepsCount} steps</span>
                    {sess.avgQuality !== null && (
                      <>
                        <span>·</span>
                        <span className="text-accent-cyan font-medium">Quality {sess.avgQuality.toFixed(1)}/4.0</span>
                      </>
                    )}
                    {sess.avgIndependence !== null && (
                      <>
                        <span>·</span>
                        <span className="text-accent-emerald font-medium">Indep {sess.avgIndependence.toFixed(1)}/4.0</span>
                      </>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Details Modal */}
      {selectedSessionId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-detail-title"
        >
          <div className="glass-panel border border-surface-border rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedSessionId(null)}
              aria-label="Close session details"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {isLoadingDetails || !sessionDetails ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                <span className="text-xs">Loading session transcript & rubric details...</span>
              </div>
            ) : (
              <div className="overflow-y-auto space-y-5 pr-1">
                <div>
                  <div className="flex items-center space-x-2 text-xs text-primary-400 font-semibold uppercase tracking-wider">
                    <BookOpen className="w-4 h-4" />
                    <span>Session Transcript & Evaluation</span>
                  </div>
                  <h3 id="session-detail-title" className="text-lg font-bold text-white mt-1">
                    {sessionDetails.topic?.title || sessionDetails.session.topicId}
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                    <span>Level: {sessionDetails.session.level}</span>
                    <span>·</span>
                    <span>Mode: {sessionDetails.session.sessionMode}</span>
                    <span>·</span>
                    <span>{formatDate(sessionDetails.session.startedAt)}</span>
                  </div>
                </div>

                {/* Steps Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Step Evaluations ({sessionDetails.steps.length})
                  </h4>

                  {sessionDetails.steps.map((step) => (
                    <div
                      key={step.id}
                      className="p-3.5 rounded-xl bg-surface-card border border-surface-border space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">
                          Step {step.stepNumber}: {step.stepSlug}
                        </span>
                        <div className="flex items-center space-x-2">
                          {step.qualityScore !== null && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
                              Quality: {step.qualityScore.toFixed(1)}/4.0
                            </span>
                          )}
                          {step.independenceScore !== null && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20">
                              Indep: {step.independenceScore}/4
                            </span>
                          )}
                        </div>
                      </div>

                      {step.coachQuestion && (
                        <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[10px] font-semibold text-primary-400 block mb-0.5">Coach Question:</span>
                          {step.coachQuestion}
                        </div>
                      )}

                      {step.userAnswer && (
                        <div className="text-xs text-slate-200 bg-surface-base p-2.5 rounded-lg border border-surface-border/60">
                          <span className="text-[10px] font-semibold text-accent-cyan block mb-0.5">Your Response:</span>
                          {step.userAnswer}
                        </div>
                      )}

                      {step.teachingResponse && (
                        <div className="text-xs text-slate-300 bg-primary-950/20 p-2.5 rounded-lg border border-primary-500/20">
                          <span className="text-[10px] font-semibold text-primary-300 block mb-0.5">Teaching Feedback:</span>
                          {step.teachingResponse}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* English Coaching Report */}
                {sessionDetails.englishReport && (
                  <div className="p-4 rounded-xl bg-surface-card border border-surface-border space-y-3">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-accent-cyan uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Post-Session English Feedback</span>
                    </div>

                    {sessionDetails.englishReport.corrections && (
                      <div className="space-y-1.5 text-xs">
                        <span className="font-medium text-slate-300">Target Corrections:</span>
                        <div className="text-slate-400 text-[11px] leading-relaxed">
                          {typeof sessionDetails.englishReport.corrections === 'string'
                            ? sessionDetails.englishReport.corrections
                            : JSON.stringify(sessionDetails.englishReport.corrections)}
                        </div>
                      </div>
                    )}

                    {sessionDetails.englishReport.seniorRewrite && (
                      <div className="p-2.5 rounded-lg bg-primary-950/20 border border-primary-500/20 text-xs">
                        <span className="font-semibold text-primary-300 block mb-1">Say it like a senior engineer:</span>
                        <p className="text-slate-300 text-[11px] italic">
                          {typeof sessionDetails.englishReport.seniorRewrite === 'string'
                            ? sessionDetails.englishReport.seniorRewrite
                            : JSON.stringify(sessionDetails.englishReport.seniorRewrite)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
