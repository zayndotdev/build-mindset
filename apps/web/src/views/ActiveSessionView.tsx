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
  MicOff,
  Volume2,
  Radio,
  Square,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface ActiveSessionViewProps {
  topicId: string;
  topicTitle: string;
  level?: 'foundation' | 'working' | 'advanced';
  sessionMode?: 'standard' | 'quick';
  initialModality?: 'voice' | 'text';
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
  initialModality = 'voice',
  onExit,
}) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = sessionMode === 'standard' ? 4 : 2;
  const [hintsRemaining, setHintsRemaining] = useState<number>(2);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [liveSpokenText, setLiveSpokenText] = useState<string>('');
  const liveSpokenTextRef = useRef<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [latestGrade, setLatestGrade] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [completedSessionData, setCompletedSessionData] = useState<any>(null);

  // Modality state: 'voice' (default) vs 'text'
  const [modality, setModality] = useState<'voice' | 'text'>(initialModality);
  const modalityRef = useRef<'voice' | 'text'>(initialModality);
  useEffect(() => {
    modalityRef.current = modality;
  }, [modality]);

  // Turn state & Voice Turn Detection
  const [turnState, setTurnState] = useState<
    'coach_speaking' | 'user_listening' | 'user_speaking' | 'submitting' | 'idle'
  >('idle');
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const recognitionInstanceRef = useRef<any>(null);
  const userAnswerRef = useRef<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Voice Recording & Transcription State
  const [recordingState, setRecordingState] = useState<'idle' | 'listening' | 'transcribing'>('idle');
  const [voiceModalityUsed, setVoiceModalityUsed] = useState<boolean>(initialModality === 'voice');
  const [originalTranscript, setOriginalTranscript] = useState<string>('');

  // Text-to-Speech (TTS) State
  const [ttsState, setTtsState] = useState<'idle' | 'speaking'>('idle');
  const ttsStateRef = useRef<'idle' | 'speaking'>('idle');
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync
  useEffect(() => {
    userAnswerRef.current = userAnswer;
  }, [userAnswer]);

  useEffect(() => {
    liveSpokenTextRef.current = liveSpokenText;
  }, [liveSpokenText]);

  useEffect(() => {
    ttsStateRef.current = ttsState;
  }, [ttsState]);

  // Auto-scroll transcript on new messages, streaming tokens, or live spoken words
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, liveSpokenText]);

  // Stop speech synthesis playback
  const stopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setTtsState('idle');
    ttsStateRef.current = 'idle';
    setCurrentlySpeakingId(null);
    if (turnState === 'coach_speaking') {
      setTurnState('idle');
    }
  };

  // Speak message content using browser speechSynthesis with callback on finish
  const speakText = (text: string, messageId: string, onDone?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onDone) onDone();
      return;
    }

    stopSpeech();

    // Clean text: strip markdown code blocks, bold/italics, and hint tags
    const cleanText = text
      .replace(/💡 Hint \(Level \d\): /g, '')
      .replace(/⏩ Step Skipped[\s\S]*?Model Answer:\n/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~>]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanText) {
      if (onDone) onDone();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const selectVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('David') ||
              v.name.includes('Daniel') ||
              v.name.includes('Alex'))
        ) || voices.find((v) => v.lang.startsWith('en'));
      if (preferred) {
        utterance.voice = preferred;
      }
    };

    selectVoice();

    utterance.onstart = () => {
      setTtsState('speaking');
      ttsStateRef.current = 'speaking';
      setCurrentlySpeakingId(messageId);
      setTurnState('coach_speaking');

      // Keep speech recognition armed so that if the user starts speaking,
      // it interrupts the coach immediately (barge-in)
      if (modalityRef.current === 'voice') {
        tryStartBargeInRecognition();
      }
    };

    utterance.onend = () => {
      setTtsState('idle');
      ttsStateRef.current = 'idle';
      setCurrentlySpeakingId(null);
      if (turnState === 'coach_speaking') {
        setTurnState('idle');
      }
      if (onDone) {
        onDone();
      }
    };

    utterance.onerror = () => {
      setTtsState('idle');
      ttsStateRef.current = 'idle';
      setCurrentlySpeakingId(null);
      if (turnState === 'coach_speaking') {
        setTurnState('idle');
      }
      if (onDone) {
        onDone();
      }
    };

    try {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis speak error:', err);
      if (onDone) onDone();
    }
  };

  // Turn Detection: Stop listening and clear timers
  const stopListening = () => {
    isListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setSilenceCountdown(null);

    if (recognitionInstanceRef.current) {
      try {
        recognitionInstanceRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    setRecordingState('idle');
    setTurnState((prev) => (prev === 'user_listening' || prev === 'user_speaking' ? 'idle' : prev));
  };

  // Arm recognition for barge-in while coach is speaking
  const tryStartBargeInRecognition = () => {
    if (isListeningRef.current) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        // User started speaking while coach was speaking -> INSTANT BARGE IN!
        if (ttsStateRef.current === 'speaking') {
          stopSpeech();
        }

        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = (final + interim).trim();
        if (text) {
          setLiveSpokenText(text);
          liveSpokenTextRef.current = text;
          setTurnState('user_speaking');

          // Reset silence timer on speech
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

          if (text.length >= 8) {
            setSilenceCountdown(2);
            let rem = 2;
            countdownIntervalRef.current = setInterval(() => {
              rem -= 1;
              if (rem > 0) {
                setSilenceCountdown(rem);
              } else {
                setSilenceCountdown(null);
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              }
            }, 1000);

            silenceTimerRef.current = setTimeout(() => {
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              setSilenceCountdown(null);
              stopListening();
              handleSubmitAnswer(undefined, text);
            }, 2000);
          }
        }
      };

      recognition.onstart = () => {
        isListeningRef.current = true;
      };

      recognition.onerror = () => {
        // Soft error during barge-in listening; ignore
      };

      recognition.onend = () => {
        isListeningRef.current = false;
      };

      recognitionInstanceRef.current = recognition;
      recognition.start();
    } catch {}
  };

  // Turn Detection: Start continuous listening with silence VAD
  const startListening = () => {
    if (isListeningRef.current || isStreaming || isCompleted) return;

    // Barge-in: cancel any running TTS
    stopSpeech();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let accumulatedFinal = '';

        recognition.onstart = () => {
          isListeningRef.current = true;
          setRecordingState('listening');
          setTurnState('user_listening');
        };

        recognition.onresult = (event: any) => {
          // If coach is speaking and user speaks, barge in immediately!
          if (ttsStateRef.current === 'speaking') {
            stopSpeech();
          }

          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              accumulatedFinal += event.results[i][0].transcript + ' ';
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }

          const combined = (accumulatedFinal + currentInterim).trim();
          if (combined) {
            if (modalityRef.current === 'voice') {
              // IN VOICE MODE: Render spoken words LIVE into the chat thread on the right side!
              setLiveSpokenText(combined);
              liveSpokenTextRef.current = combined;
            } else {
              setUserAnswer(combined);
              userAnswerRef.current = combined;
            }

            setOriginalTranscript(combined);
            setVoiceModalityUsed(true);
            setTurnState('user_speaking');

            // Reset silence detection timer on each recognized word
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }

            // In Voice Mode, if the user has spoken substantive content (>= 8 chars), arm the 2.0s silence timer
            if (modalityRef.current === 'voice' && combined.length >= 8) {
              setSilenceCountdown(2);
              let remaining = 2;
              countdownIntervalRef.current = setInterval(() => {
                remaining -= 1;
                if (remaining > 0) {
                  setSilenceCountdown(remaining);
                } else {
                  setSilenceCountdown(null);
                  if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                  }
                }
              }, 1000);

              silenceTimerRef.current = setTimeout(() => {
                // 2 seconds of silence detected -> auto-submit user turn!
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
                setSilenceCountdown(null);
                stopListening();
                handleSubmitAnswer(undefined, combined);
              }, 2000);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error event:', event.error);
          if (event.error === 'no-speech') {
            // User is thinking; stay listening
            return;
          }
          if (event.error === 'not-allowed') {
            setErrorMessage('Microphone access denied. Please enable mic permissions in your browser.');
            stopListening();
          }
        };

        recognition.onend = () => {
          // If still marked as listening in voice mode, restart to maintain hands-free loop
          if (isListeningRef.current && modalityRef.current === 'voice' && !isStreaming) {
            try {
              recognition.start();
            } catch {
              isListeningRef.current = false;
              setRecordingState('idle');
              setTurnState('idle');
            }
          } else {
            isListeningRef.current = false;
            setRecordingState('idle');
            setTurnState('idle');
          }
        };

        recognitionInstanceRef.current = recognition;
        recognition.start();
        return;
      } catch (e) {
        console.warn('SpeechRecognition start failed, falling back to MediaRecorder:', e);
      }
    }

    // MediaRecorder fallback
    startMediaRecorderFallback();
  };

  // MediaRecorder fallback for browsers without SpeechRecognition
  const startMediaRecorderFallback = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecordingState('transcribing');

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        try {
          const res = await fetch('/api/v1/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
            credentials: 'include',
            body: audioBlob,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Voice transcription failed');
          }

          const data = await res.json();
          if (data.text) {
            if (modalityRef.current === 'voice') {
              setLiveSpokenText(data.text);
              liveSpokenTextRef.current = data.text;
              handleSubmitAnswer(undefined, data.text);
            } else {
              setUserAnswer(data.text);
              userAnswerRef.current = data.text;
            }
            setOriginalTranscript(data.text);
            setVoiceModalityUsed(true);
          }
        } catch (err: any) {
          setErrorMessage(err.message || 'Voice transcription failed');
        } finally {
          setRecordingState('idle');
        }
      };

      mediaRecorder.start();
      isListeningRef.current = true;
      setRecordingState('listening');
      setTurnState('user_listening');
    } catch (err: any) {
      setErrorMessage(err.message || 'Microphone access denied or unavailable');
      setRecordingState('idle');
      setTurnState('idle');
    }
  };

  // Modality switcher (Voice Mode vs Text Mode)
  const handleSwitchModality = (targetModality: 'voice' | 'text') => {
    stopSpeech();
    stopListening();
    setLiveSpokenText('');
    liveSpokenTextRef.current = '';
    setModality(targetModality);
    modalityRef.current = targetModality;
    if (targetModality === 'voice') {
      setVoiceModalityUsed(true);
      // If idle and messages exist, coach starts listening
      if (!isStreaming && !isCompleted && messages.length > 0) {
        startListening();
      }
    }
  };

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

        const initQuestion =
          data.initialQuestion || 'Welcome! Let us begin our architectural discussion.';
        const initMsgId = `init-${Date.now()}`;

        // Initial coach question
        setMessages([
          {
            id: initMsgId,
            role: 'coach',
            content: initQuestion,
            stepNumber: data.currentStep || 1,
          },
        ]);

        // In Voice Mode: automatically speak the initial question without requiring manual "Listen" click!
        if (modalityRef.current === 'voice') {
          setTimeout(() => {
            if (!isMounted) return;
            speakText(initQuestion, initMsgId, () => {
              if (isMounted && modalityRef.current === 'voice') {
                startListening();
              }
            });
          }, 300);
        }
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
      stopSpeech();
      stopListening();
    };
  }, [topicId, level, sessionMode]);

  // Submit Answer via SSE Stream
  const handleSubmitAnswer = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const answerToSubmit = (
      overrideText !== undefined
        ? overrideText
        : modalityRef.current === 'voice'
        ? liveSpokenTextRef.current || liveSpokenText
        : userAnswer
    ).trim();

    if (!answerToSubmit || isStreaming || !sessionId || isCompleted) return;

    // Barge-in: stop any running speech or recording
    stopSpeech();
    stopListening();

    setTurnState('submitting');
    const isVoice = voiceModalityUsed || modalityRef.current === 'voice';
    const rawVoice = originalTranscript || answerToSubmit;

    setUserAnswer('');
    userAnswerRef.current = '';
    setLiveSpokenText('');
    liveSpokenTextRef.current = '';
    setOriginalTranscript('');
    setErrorMessage(null);
    setLatestGrade(null);

    // Append user answer immediately to UI transcript on the RIGHT side
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
        body: JSON.stringify({
          answer: answerToSubmit,
          modality: isVoice ? 'voice' : 'text',
          voiceTranscriptOriginal: isVoice ? rawVoice : undefined,
        }),
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
        buffer = lines.pop() || '';

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
                // Finalize coach response in messages on the LEFT side
                const finalContent =
                  accumulatedCoachText ||
                  gradeEventData?.rubric?.suggestedFollowup ||
                  gradeEventData?.rubric?.feedback ||
                  'Let us proceed to the next step.';

                const newCoachMsgId = `coach-${Date.now()}`;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: newCoachMsgId,
                    role: 'coach',
                    content: finalContent,
                    stepNumber: parsed.currentStep,
                    gradeResult: gradeEventData,
                  },
                ]);

                setCurrentStep(parsed.currentStep);
                setHintsRemaining(parsed.hintsRemaining ?? 2);
                setStreamingText('');

                if (parsed.isCompleted) {
                  setIsCompleted(true);
                  fetchFullSessionDetails(sessionId);
                  if (modalityRef.current === 'voice') {
                    speakText(finalContent, newCoachMsgId);
                  }
                } else {
                  // In Voice Mode: coach speaks reply out loud, then automatically starts listening!
                  if (modalityRef.current === 'voice') {
                    speakText(finalContent, newCoachMsgId, () => {
                      if (modalityRef.current === 'voice') {
                        startListening();
                      }
                    });
                  } else {
                    setTurnState('idle');
                  }
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
      setTurnState('idle');
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

      const hintText = `💡 Hint (Level ${data.hintLevel}): ${data.hint}`;
      const hintMsgId = `hint-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        {
          id: hintMsgId,
          role: 'coach',
          content: hintText,
          stepNumber: currentStep,
        },
      ]);

      if (modalityRef.current === 'voice') {
        speakText(data.hint, hintMsgId, () => {
          if (modalityRef.current === 'voice') {
            startListening();
          }
        });
      }
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
        <Loader2 className="w-9 h-9 text-primary animate-spin" />
        <div className="text-center">
          <h3 className="text-base font-bold text-text-primary">Preparing Socratic Session</h3>
          <p className="text-xs text-text-secondary mt-1">
            Loading rubric key points & priming coach state machine...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-xl mx-auto pb-4">
      {/* Session Top Bar */}
      <div className="bg-surface rounded-2xl p-4 border border-surface-border mb-3 flex items-center justify-between shadow-card">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-bold text-white text-xs shadow-primary">
            S{currentStep}
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary truncate max-w-[170px] sm:max-w-xs">
              {topicTitle}
            </h3>
            <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-text-muted">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>•</span>
              <span className="capitalize text-primary font-semibold">{level}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Prominent Modality Switcher Toggle */}
          <div className="flex items-center bg-surface-subtle p-0.5 rounded-xl border border-surface-border text-xs">
            <button
              type="button"
              onClick={() => handleSwitchModality('voice')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                modality === 'voice'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="Voice Mode: Hands-free spoken conversation"
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voice</span>
              {modality === 'voice' && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSwitchModality('text')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                modality === 'text'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="Text Mode: Keyboard-driven silent discussion"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Text</span>
            </button>
          </div>

          {/* Hints Badge */}
          <button
            onClick={handleRequestHint}
            disabled={hintsRemaining <= 0 || isStreaming || isCompleted}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              hintsRemaining > 0 && !isCompleted
                ? 'bg-warning-subtle border-warning-border text-warning-text hover:bg-warning-subtle/80'
                : 'bg-surface-subtle border-surface-border text-text-muted cursor-not-allowed opacity-60'
            }`}
            title={`Request Socratic Hint (${hintsRemaining} remaining)`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{hintsRemaining}/2</span>
          </button>

          {/* Exit Session Button */}
          <button
            onClick={() => {
              if (window.confirm('Leave active session? Your progress is saved.')) {
                stopSpeech();
                stopListening();
                onExit();
              }
            }}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-subtle transition-colors"
            title="Exit Session"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-3 p-3 rounded-xl bg-danger-subtle border border-danger-border text-danger-text text-xs flex items-center space-x-2">
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
              className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-soft ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : msg.role === 'system'
                  ? 'bg-surface-subtle border border-warning-border text-text-secondary rounded-bl-sm font-mono text-xs'
                  : 'bg-surface border border-surface-border text-text-primary rounded-bl-sm'
              }`}
            >
              {/* Role Header */}
              <div className="flex items-center justify-between space-x-2 mb-1.5 opacity-75 text-[10px] font-bold uppercase tracking-wider">
                <span>{msg.role === 'user' ? 'You' : msg.role === 'system' ? 'Reference Model' : 'Socratic Coach'}</span>
                <span>Step {msg.stepNumber}</span>
              </div>

              {/* Message Body */}
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* TTS Audio Player Control for Coach Messages */}
              {msg.role === 'coach' && (
                <div className="mt-2.5 pt-2 border-t border-surface-border flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => speakText(msg.content, msg.id)}
                    className="inline-flex items-center space-x-1.5 text-text-muted hover:text-primary transition-colors"
                    title={currentlySpeakingId === msg.id && ttsState === 'speaking' ? 'Stop audio' : 'Listen with TTS'}
                  >
                    {currentlySpeakingId === msg.id && ttsState === 'speaking' ? (
                      <>
                        <Square className="w-3.5 h-3.5 text-tertiary fill-current animate-pulse" />
                        <span className="text-tertiary font-medium">Stop Audio</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>
                  {modality === 'voice' && (
                    <span className="text-[10px] text-primary font-medium flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span>Voice active</span>
                    </span>
                  )}
                </div>
              )}

              {/* Rubric Badge if evaluated */}
              {msg.gradeResult && (
                <div className="mt-3 pt-2.5 border-t border-surface-border flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                      msg.gradeResult.qualityScore >= 3
                        ? 'bg-success-subtle text-success-text border-success-border'
                        : 'bg-warning-subtle text-warning-text border-warning-border'
                    }`}
                  >
                    Quality: {msg.gradeResult.qualityScore}/4
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-subtle text-primary-text border border-primary-border">
                    Independence: {msg.gradeResult.independenceScore}/4
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Spoken User Turn (Appears dynamically in the conversation thread on the RIGHT side) */}
        {modality === 'voice' && (liveSpokenText.trim().length > 0 || recordingState === 'listening') && (
          <div className="flex flex-col items-end animate-fade-in">
            <div className="max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed bg-primary text-white rounded-br-sm shadow-soft border border-white/20">
              <div className="flex items-center justify-between space-x-3 mb-1.5 opacity-85 text-[10px] font-bold uppercase tracking-wider">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>You (Speaking...)</span>
                </span>
                <span>Step {currentStep}</span>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">
                {liveSpokenText || (
                  <span className="italic opacity-80">Listening to your voice... Speak your answer...</span>
                )}
                {liveSpokenText && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-white/80 animate-pulse" />
                )}
              </div>
              {silenceCountdown !== null && (
                <div className="mt-2.5 pt-2 border-t border-white/20 text-[11px] text-white/90 flex items-center justify-between">
                  <span className="font-medium">Auto-submitting in {silenceCountdown}s of silence...</span>
                  <button
                    type="button"
                    onClick={() => {
                      const text = liveSpokenTextRef.current || liveSpokenText;
                      stopListening();
                      handleSubmitAnswer(undefined, text);
                    }}
                    className="text-[10px] bg-white text-primary px-2.5 py-0.5 rounded-full font-bold shadow-2xs hover:bg-white/90"
                  >
                    Send Now
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live SSE Streaming Tokens Display (LEFT Side) */}
        {isStreaming && (
          <div className="flex flex-col items-start">
            <div className="max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed bg-surface border border-primary/40 text-text-primary rounded-bl-sm shadow-soft">
              <div className="flex items-center space-x-2 mb-1.5 text-primary text-[10px] font-bold uppercase tracking-wider">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Coach is analyzing & responding...</span>
              </div>

              {/* Instant Grade Preview */}
              {latestGrade && (
                <div className="mb-2 p-2 rounded-lg bg-surface-subtle border border-surface-border flex items-center space-x-2 text-xs">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  <span className="font-bold text-text-primary">Score: {latestGrade.qualityScore}/4</span>
                  <span className="text-text-muted">•</span>
                  <span className="text-text-secondary">Independence: {latestGrade.independenceScore}/4</span>
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
        <div className="bg-surface rounded-2xl p-5 border border-success-border mt-3 shadow-card">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 rounded-xl bg-success-subtle text-success">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Session Completed!</h3>
              <p className="text-xs text-text-secondary">All design steps completed and scored.</p>
            </div>
          </div>

          {completedSessionData?.skillScore && (
            <div className="grid grid-cols-2 gap-2.5 my-3 text-center">
              <div className="p-2.5 rounded-xl bg-surface-subtle border border-surface-border">
                <div className="text-[11px] text-text-muted uppercase font-semibold">Answer Quality</div>
                <div className="text-xl font-bold text-success-text mt-0.5">
                  {completedSessionData.skillScore.qualityScore} / 4.0
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-subtle border border-surface-border">
                <div className="text-[11px] text-text-muted uppercase font-semibold">Independence</div>
                <div className="text-xl font-bold text-primary-text mt-0.5">
                  {completedSessionData.skillScore.independenceScore} / 4.0
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              onClick={() => {
                stopSpeech();
                stopListening();
                onExit();
              }}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-primary transition-all"
            >
              <span>Return to Curriculum</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Voice Mode: Dedicated Voice HUD (NO text SMS box) */}
      {modality === 'voice' && !isCompleted && (
        <div className="mt-3 bg-surface rounded-2xl p-3.5 border border-surface-border shadow-soft animate-fade-in">
          <div className="flex items-center justify-between">
            {/* Left: Turn Status & Visual Feedback */}
            <div className="flex items-center space-x-3">
              {ttsState === 'speaking' ? (
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-primary-subtle border border-primary-border flex items-center justify-center text-primary shadow-xs">
                    <Volume2 className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-primary flex items-center space-x-1.5">
                      <span>Coach Speaking</span>
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    </div>
                    <div className="text-[11px] text-text-muted">Speak or tap below to interrupt</div>
                  </div>
                </div>
              ) : isStreaming ? (
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-primary-subtle border border-primary-border flex items-center justify-center text-primary shadow-xs">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-primary">Coach Evaluating...</div>
                    <div className="text-[11px] text-text-muted">Analyzing architecture trade-offs</div>
                  </div>
                </div>
              ) : recordingState === 'listening' ? (
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-danger-subtle border border-danger-border flex items-center justify-center text-danger shadow-xs animate-pulse">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-danger-text flex items-center space-x-1.5">
                      <span>{liveSpokenText ? 'Speaking...' : 'Listening...'}</span>
                      <span className="w-2 h-2 rounded-full bg-danger animate-ping" />
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {silenceCountdown !== null
                        ? `Auto-submitting in ${silenceCountdown}s...`
                        : 'Pause 2s to submit, or tap Done Speaking'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-surface-subtle border border-surface-border flex items-center justify-center text-text-muted">
                    <MicOff className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-primary">Mic Paused</div>
                    <div className="text-[11px] text-text-muted">Tap Start Speaking to answer</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Interactive Controls */}
            <div className="flex items-center space-x-2">
              {ttsState === 'speaking' ? (
                <button
                  type="button"
                  onClick={() => {
                    stopSpeech();
                    startListening();
                  }}
                  className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-primary transition-all flex items-center space-x-1.5"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Interrupt</span>
                </button>
              ) : recordingState === 'listening' ? (
                <>
                  {liveSpokenText.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const textToSubmit = liveSpokenTextRef.current || liveSpokenText;
                        stopListening();
                        handleSubmitAnswer(undefined, textToSubmit);
                      }}
                      className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-primary transition-all flex items-center space-x-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Done Speaking</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={stopListening}
                    className="p-2 rounded-xl border border-surface-border hover:bg-surface-subtle text-text-secondary transition-all"
                    title="Pause Microphone"
                  >
                    <MicOff className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startListening}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-primary transition-all flex items-center space-x-1.5"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Speaking</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSkipStep}
                disabled={isStreaming}
                className="p-2 rounded-xl text-text-muted hover:text-warning-text transition-colors"
                title="Skip Step"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Mode: Standard Keyboard typing form (Only shown in Text Mode) */}
      {modality === 'text' && !isCompleted && (
        <form onSubmit={handleSubmitAnswer} className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-text-muted px-1 mb-1">
            <span>Type your architectural response and press Enter to send</span>
            <button
              type="button"
              onClick={handleSkipStep}
              disabled={isStreaming}
              className="text-text-muted hover:text-warning-text inline-flex items-center space-x-1 transition-colors"
            >
              <SkipForward className="w-3 h-3" />
              <span>Skip Step</span>
            </button>
          </div>

          <div className="relative flex items-center">
            <textarea
              value={userAnswer}
              onChange={(e) => {
                setUserAnswer(e.target.value);
                userAnswerRef.current = e.target.value;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitAnswer();
                }
              }}
              disabled={isStreaming}
              placeholder="State your architectural reasoning (e.g. data structures, algorithms, scaling risks)..."
              rows={2}
              className="w-full pl-3.5 pr-14 py-2.5 rounded-2xl bg-surface border border-surface-border focus:border-primary focus:ring-1 focus:ring-primary text-text-primary placeholder:text-text-muted text-xs sm:text-sm resize-none transition-all shadow-xs"
            />

            <div className="absolute right-2 flex items-center space-x-1">
              <button
                type="submit"
                disabled={!userAnswer.trim() || isStreaming}
                className="p-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-white transition-all shadow-primary"
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
