import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Lightbulb,
  SkipForward,
  XCircle,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Mic,
} from 'lucide-react';

interface ActiveSessionViewProps {
  topicId: string;
  topicTitle: string;
  level?: 'foundation' | 'working' | 'advanced';
  sessionMode?: 'standard' | 'quick';
  onExit: () => void;
}

interface MessageItem {
  id: string;
  role: 'coach' | 'user' | 'system';
  content: string;
  stepNumber: number;
  gradeResult?: {
    qualityScore: number;
    independenceScore: number;
    feedback: string;
    coveredKeyPoints: string[];
    missingKeyPoints: string[];
  };
}

export const ActiveSessionView: React.FC<ActiveSessionViewProps> = ({
  topicId,
  topicTitle,
  level = 'working',
  sessionMode = 'standard',
  onExit,
}) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = sessionMode === 'standard' ? 4 : 2;
  const [hintsRemaining, setHintsRemaining] = useState<number>(2);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [latestGrade, setLatestGrade] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [completedSessionData, setCompletedSessionData] = useState<any>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript on new messages or streaming tokens
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Start new learning session on mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        setIsInitializing(true);
        setErrorMessage(null);

        const res = await fetch('/api/v1/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            topicId,
            level,
            sessionMode,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `Failed to create session (${res.status})`);
        }

        const data = await res.json();
        if (!isMounted) return;

        setSessionId(data.session.id);
        setCurrentStep(data.currentStep || 1);
        setHintsRemaining(data.hintsRemaining ?? 2);

        // Initial coach question
        setMessages([
          {
            id: `init-${Date.now()}`,
            role: 'coach',
            content: data.initialQuestion || 'Welcome! Let us begin our architectural discussion.',
            stepNumber: data.currentStep || 1,
          },
        ]);
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Error initializing session');
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [topicId, level, sessionMode]);

  // Submit Answer via SSE Stream
  const handleSubmitAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userAnswer.trim() || isStreaming || !sessionId || isCompleted) return;

    const answerToSubmit = userAnswer.trim();
    setUserAnswer('');
    setErrorMessage(null);
    setLatestGrade(null);

    // Append user answer immediately to UI transcript
    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: answerToSubmit,
      stepNumber: currentStep,
    };
    setMessages((prev) => [...prev, userMsg]);

    setIsStreaming(true);
    setStreamingText('');

    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        credentials: 'include',
        body: JSON.stringify({ answer: answerToSubmit }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || `Error submitting answer (${res.status})`);
      }

      if (!res.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedCoachText = '';
      let gradeEventData: any = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep remainder in buffer

        let currentEvent = 'message';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            const rawData = line.replace('data:', '').trim();
            if (!rawData) continue;

            try {
              const parsed = JSON.parse(rawData);

              if (currentEvent === 'grade') {
                gradeEventData = parsed;
                setLatestGrade(parsed);
              } else if (currentEvent === 'token') {
                accumulatedCoachText += parsed.delta || '';
                setStreamingText(accumulatedCoachText);
              } else if (currentEvent === 'done') {
                // Finalize coach response in messages
                if (accumulatedCoachText) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `coach-${Date.now()}`,
                      role: 'coach',
                      content: accumulatedCoachText,
                      stepNumber: parsed.currentStep,
                      gradeResult: gradeEventData,
                    },
                  ]);
                }

                setCurrentStep(parsed.currentStep);
                setHintsRemaining(parsed.hintsRemaining ?? 2);
                setStreamingText('');

                if (parsed.isCompleted) {
                  setIsCompleted(true);
                  // Load full session recap
                  fetchFullSessionDetails(sessionId);
                }
              } else if (currentEvent === 'error') {
                throw new Error(parsed.message || 'Stream processing error');
              }
            } catch (parseErr: any) {
              console.warn('Failed to parse SSE data packet:', parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit answer stream');
    } finally {
      setIsStreaming(false);
    }
  };

  // Request Hint (Hard capped at 2 per step)
  const handleRequestHint = async () => {
    if (!sessionId || hintsRemaining <= 0 || isStreaming || isCompleted) return;

    try {
      setErrorMessage(null);
      const res = await fetch(`/api/v1/sessions/${sessionId}/hint`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || 'Failed to request hint');
      }

      const data = await res.json();
      setHintsRemaining(data.hintsRemaining);

      setMessages((prev) => [
        ...prev,
        {
          id: `hint-${Date.now()}`,
          role: 'coach',
          content: `💡 Hint (Level ${data.hintLevel}): ${data.hint}`,
          stepNumber: currentStep,
        },
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error requesting hint');
    }
  };

  // Skip Step (Awards model answer, sets independence score = 0)
  const handleSkipStep = async () => {
    if (!sessionId || isStreaming || isCompleted) return;
    const confirmed = window.confirm(
      'Skip this step? You will receive the reference model answer, and your independence score for this step will be set to 0.'
    );
    if (!confirmed) return;

    try {
      setErrorMessage(null);
      const res = await fetch(`/api/v1/sessions/${sessionId}/skip`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || 'Failed to skip step');
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: `skip-${Date.now()}`,
          role: 'system',
          content: `⏩ Step Skipped (Independence: 0/4)\n\nModel Answer:\n${data.modelAnswer}`,
          stepNumber: currentStep,
        },
      ]);

      setCurrentStep(data.currentStep);
      setHintsRemaining(data.hintsRemaining ?? 2);

      if (data.isCompleted) {
        setIsCompleted(true);
        fetchFullSessionDetails(sessionId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error skipping step');
    }
  };

  const fetchFullSessionDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/sessions/${id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCompletedSessionData(data);
      }
    } catch (err) {
      console.warn('Error fetching completed session details:', err);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-9 h-9 text-primary-500 animate-spin" />
        <div className="text-center">
          <h3 className="text-base font-bold text-white">Preparing Socratic Session</h3>
          <p className="text-xs text-slate-400 mt-1">
            Loading rubric key points & priming coach state machine...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-xl mx-auto pb-4">
      {/* Session Top Bar */}
      <div className="glass-card rounded-2xl p-4 border border-surface-border mb-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-cyan flex items-center justify-center font-bold text-white text-xs">
            S{currentStep}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">
              {topicTitle}
            </h3>
            <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-400">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>•</span>
              <span className="capitalize text-primary-400">{level}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Hints Badge */}
          <button
            onClick={handleRequestHint}
            disabled={hintsRemaining <= 0 || isStreaming || isCompleted}
            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              hintsRemaining > 0 && !isCompleted
                ? 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber hover:bg-accent-amber/20'
                : 'bg-surface-card border-surface-border text-slate-500 cursor-not-allowed opacity-60'
            }`}
            title={`Request Socratic Hint (${hintsRemaining} remaining)`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{hintsRemaining}/2 Hints</span>
          </button>

          {/* Exit Session Button */}
          <button
            onClick={() => {
              if (window.confirm('Leave active session? Your progress is saved.')) {
                onExit();
              }
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-card transition-colors"
            title="Exit Session"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-3 p-3 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Messages Transcript Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-br-sm'
                  : msg.role === 'system'
                  ? 'bg-surface-card border border-accent-amber/30 text-slate-300 rounded-bl-sm font-mono text-xs'
                  : 'glass-card border border-surface-border text-slate-200 rounded-bl-sm'
              }`}
            >
              {/* Role Header */}
              <div className="flex items-center justify-between space-x-2 mb-1.5 opacity-75 text-[10px] font-semibold uppercase tracking-wider">
                <span>{msg.role === 'user' ? 'You' : msg.role === 'system' ? 'Reference Model' : 'Socratic Coach'}</span>
                <span>Step {msg.stepNumber}</span>
              </div>

              {/* Message Body */}
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Rubric Badge if evaluated */}
              {msg.gradeResult && (
                <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    msg.gradeResult.qualityScore >= 3
                      ? 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/30'
                      : 'bg-accent-amber/20 text-accent-amber border border-accent-amber/30'
                  }`}>
                    Quality: {msg.gradeResult.qualityScore}/4
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                    Independence: {msg.gradeResult.independenceScore}/4
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live SSE Streaming Tokens Display */}
        {isStreaming && (
          <div className="flex flex-col items-start">
            <div className="max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed glass-card border border-primary-500/40 text-slate-200 rounded-bl-sm animate-pulse-border">
              <div className="flex items-center space-x-2 mb-1.5 text-primary-400 text-[10px] font-semibold uppercase tracking-wider">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Coach is analyzing & responding...</span>
              </div>

              {/* Instant Grade Preview */}
              {latestGrade && (
                <div className="mb-2 p-2 rounded-lg bg-surface-card border border-surface-border flex items-center space-x-2 text-xs">
                  <Award className="w-3.5 h-3.5 text-primary-400" />
                  <span className="font-semibold text-white">Score: {latestGrade.qualityScore}/4</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300">Independence: {latestGrade.independenceScore}/4</span>
                </div>
              )}

              <div className="whitespace-pre-wrap">
                {streamingText || 'Generating Socratic follow-up...'}
              </div>
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Completed Session Celebration Modal / Summary Card */}
      {isCompleted && (
        <div className="glass-card rounded-2xl p-5 border border-accent-emerald/30 mt-3 shadow-xl bg-surface-card/95">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 rounded-xl bg-accent-emerald/10 text-accent-emerald">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Session Completed!</h3>
              <p className="text-xs text-slate-400">All design steps completed and scored.</p>
            </div>
          </div>

          {completedSessionData?.skillScore && (
            <div className="grid grid-cols-2 gap-2.5 my-3 text-center">
              <div className="p-2.5 rounded-xl bg-surface-card border border-surface-border">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Answer Quality</div>
                <div className="text-xl font-bold text-accent-emerald mt-0.5">
                  {completedSessionData.skillScore.qualityScore} / 4.0
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-card border border-surface-border">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Independence</div>
                <div className="text-xl font-bold text-primary-400 mt-0.5">
                  {completedSessionData.skillScore.independenceScore} / 4.0
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              onClick={onExit}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              <span>Return to Curriculum</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Answer Input Form */}
      {!isCompleted && (
        <form onSubmit={handleSubmitAnswer} className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 mb-1">
            <span>Voice or text responses evaluated on depth and tradeoffs</span>
            <button
              type="button"
              onClick={handleSkipStep}
              disabled={isStreaming}
              className="text-slate-400 hover:text-accent-amber inline-flex items-center space-x-1 transition-colors"
            >
              <SkipForward className="w-3 h-3" />
              <span>Skip Step</span>
            </button>
          </div>

          <div className="relative flex items-center">
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitAnswer();
                }
              }}
              disabled={isStreaming}
              placeholder="State your architectural reasoning (e.g. data structures, algorithms, scaling risks)..."
              rows={2}
              className="w-full pl-3.5 pr-24 py-2.5 rounded-2xl bg-surface-card border border-surface-border focus:border-primary-500/80 focus:ring-1 focus:ring-primary-500 text-white placeholder-slate-500 text-xs sm:text-sm resize-none transition-all shadow-inner"
            />

            <div className="absolute right-2 flex items-center space-x-1">
              <button
                type="button"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Voice input (mock microphone)"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="submit"
                disabled={!userAnswer.trim() || isStreaming}
                className="p-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white transition-all shadow-md shadow-primary-500/20"
                title="Submit Answer"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
