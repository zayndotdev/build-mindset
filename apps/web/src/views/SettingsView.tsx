import React, { useState, useEffect, useCallback } from 'react';
import {
  Volume2,
  Database,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Star,
  Activity,
  Palette,
  HardDrive,
  Play,
} from 'lucide-react';

interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  isDefault?: boolean;
}

interface ProviderStatus {
  id: 'gemini' | 'groq' | 'mistral' | 'cohere';
  model: string;
  priority: number;
  isGradingPrimary: boolean;
  hasKey: boolean;
  isHealthy: boolean;
  lastError: string | null;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  isResting: boolean;
  restingUntil: string | null;
  models: ModelInfo[];
}

const PROVIDER_NAMES: Record<string, string> = {
  gemini: 'Google Gemini (Primary)',
  groq: 'Groq Cloud (Llama 3.3)',
  mistral: 'Mistral AI',
  cohere: 'Cohere Command R+',
};

export const SettingsView: React.FC = () => {
  const [voiceAccent, setVoiceAccent] = useState('en-US');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [activeSettingsSection, setActiveSettingsSection] = useState<'voice' | 'providers' | 'storage' | 'theme'>('providers');

  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [savingKeyId, setSavingKeyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; isError?: boolean } | null>(null);
  const [cacheCleared, setCacheCleared] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers);
      }
    } catch {
      // offline / mock mode
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleSaveKey = async (id: string) => {
    const key = keyInputs[id];
    if (!key || key.trim().length === 0) return;

    try {
      setSavingKeyId(id);
      const res = await fetch(`/api/v1/providers/${id}/key`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key.trim() }),
      });

      if (res.ok) {
        setKeyInputs((prev) => ({ ...prev, [id]: '' }));
        setActionMessage({ id, text: 'API key encrypted with AES-256 and saved securely!' });
        await fetchProviders();
      } else {
        const errData = await res.json();
        setActionMessage({ id, text: errData.error?.message || 'Failed to save key', isError: true });
      }
    } catch {
      setActionMessage({ id, text: 'Network error saving key', isError: true });
    } finally {
      setSavingKeyId(null);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!window.confirm(`Are you sure you want to remove the API key for ${PROVIDER_NAMES[id] || id}?`)) return;

    try {
      const res = await fetch(`/api/v1/providers/${id}/key`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setActionMessage({ id, text: 'API key removed.' });
        await fetchProviders();
      }
    } catch {
      setActionMessage({ id, text: 'Failed to remove key', isError: true });
    }
  };

  const handleTestProvider = async (id: string) => {
    try {
      setTestingId(id);
      const res = await fetch(`/api/v1/providers/${id}/test`, {
        method: 'POST',
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setActionMessage({ id, text: `Connected! Discovered ${result.models.length} live models.` });
        } else {
          setActionMessage({ id, text: result.error || 'Connection check failed', isError: true });
        }
        await fetchProviders();
      }
    } catch {
      setActionMessage({ id, text: 'Test request failed', isError: true });
    } finally {
      setTestingId(null);
    }
  };

  const handleUpdateConfig = async (id: string, updates: { model?: string; isGradingPrimary?: boolean }) => {
    try {
      const res = await fetch(`/api/v1/providers/${id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        await fetchProviders();
      }
    } catch {
      // offline
    }
  };

  const handleClearCache = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
          System Settings & Resilience
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          Configure multi-provider AI fallbacks, circuit breakers, voice playback, and offline persistence
        </p>
      </div>

      {/* 2-Column Responsive Layout on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Quick Navigation / Category Cards */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-surface rounded-2xl p-3 border border-surface-border shadow-soft space-y-1">
            <button
              onClick={() => setActiveSettingsSection('providers')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all text-left ${
                activeSettingsSection === 'providers'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Cpu className="w-4 h-4" />
                <span>AI Providers & Fallbacks</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                activeSettingsSection === 'providers' ? 'bg-white/20 text-white' : 'bg-surface-subtle text-text-muted'
              }`}>
                4 Providers
              </span>
            </button>

            <button
              onClick={() => setActiveSettingsSection('voice')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all text-left ${
                activeSettingsSection === 'voice'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Volume2 className="w-4 h-4" />
                <span>Voice & Speech Audio</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                activeSettingsSection === 'voice' ? 'bg-white/20 text-white' : 'bg-surface-subtle text-text-muted'
              }`}>
                {voiceSpeed}x
              </span>
            </button>

            <button
              onClick={() => setActiveSettingsSection('storage')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all text-left ${
                activeSettingsSection === 'storage'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <HardDrive className="w-4 h-4" />
                <span>Storage & Offline Cache</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                activeSettingsSection === 'storage' ? 'bg-white/20 text-white' : 'bg-surface-subtle text-text-muted'
              }`}>
                SQLite
              </span>
            </button>

            <button
              onClick={() => setActiveSettingsSection('theme')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all text-left ${
                activeSettingsSection === 'theme'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Palette className="w-4 h-4" />
                <span>Color Theme & Tokens</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                activeSettingsSection === 'theme' ? 'bg-white/20 text-white' : 'bg-surface-subtle text-text-muted'
              }`}>
                CSS Vars
              </span>
            </button>
          </div>

          {/* Quick System Architecture Note */}
          <div className="p-4 rounded-2xl bg-surface-subtle border border-surface-border text-xs text-text-muted space-y-2">
            <div className="flex items-center space-x-1.5 font-bold text-text-primary">
              <ShieldCheck className="w-4 h-4 text-success" />
              <span>Zero-Cloud Privacy Policy</span>
            </div>
            <p className="leading-relaxed">
              API keys are encrypted using AES-256-GCM. Passphrases are hashed with Argon2id. All transcripts stay in local storage.
            </p>
          </div>
        </div>

        {/* Right Column: Active Configuration Panels */}
        <div className="lg:col-span-8 space-y-6">
          {/* Panel 1: AI Provider Routing & Keys */}
          {activeSettingsSection === 'providers' && (
            <div className="bg-surface rounded-3xl p-6 sm:p-7 border border-surface-border shadow-soft space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div>
                  <h3 className="text-base font-extrabold text-text-primary">AI Provider Routing & Fallback Pipeline</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Requests automatically cascade P1 &rarr; P2 &rarr; P3 &rarr; P4. If a provider exhausts quota (429), it rests with exponential backoff.
                  </p>
                </div>
                <button
                  onClick={fetchProviders}
                  disabled={loading}
                  className="flex items-center space-x-1 text-xs text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-xl bg-surface-subtle border border-surface-border font-bold transition-all shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="space-y-4">
                {providers.map((p) => {
                  const hasKey = p.hasKey;
                  const isGrader = p.isGradingPrimary;
                  const isCircuitOpen = p.circuitState === 'OPEN';
                  const isResting = p.isResting;

                  return (
                    <div
                      key={p.id}
                      className="p-5 rounded-2xl bg-surface-subtle border border-surface-border space-y-4 hover:border-surface-border-strong transition-all"
                    >
                      {/* Top Row: Provider Name & Badges */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-surface border border-surface-border text-primary shadow-2xs">
                            P{p.priority}
                          </span>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-extrabold text-text-primary">
                                {PROVIDER_NAMES[p.id] || p.id}
                              </span>
                              {isGrader && (
                                <span className="flex items-center space-x-1 text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary-subtle border border-primary-border">
                                  <Star className="w-3 h-3 fill-primary" />
                                  <span>Primary Grader</span>
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-text-muted font-mono mt-0.5 block">
                              Active: {p.model}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-start sm:self-auto">
                          {hasKey ? (
                            <span className="flex items-center space-x-1 text-[10px] font-bold text-success-text px-2 py-0.5 rounded-full bg-success-subtle border border-success-border">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Encrypted</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-warning-text px-2 py-0.5 rounded-full bg-warning-subtle border border-warning-border">
                              No Key (Mocked)
                            </span>
                          )}

                          {isCircuitOpen ? (
                            <span className="text-[10px] font-bold text-danger-text px-2 py-0.5 rounded-full bg-danger-subtle border border-danger-border">
                              Circuit Open
                            </span>
                          ) : isResting ? (
                            <span className="text-[10px] font-bold text-warning-text px-2 py-0.5 rounded-full bg-warning-subtle border border-warning-border">
                              Resting (429)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-success-text px-2 py-0.5 rounded-full bg-surface border border-surface-border">
                              Healthy
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Model Selector & Primary Anchor Toggle */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-text-secondary mb-1">
                            Model Variant
                          </label>
                          <select
                            value={p.model}
                            onChange={(e) => handleUpdateConfig(p.id, { model: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-text-primary text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-xs"
                          >
                            {p.models && p.models.length > 0 ? (
                              p.models.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name || m.id}
                                </option>
                              ))
                            ) : (
                              <option value={p.model}>{p.model}</option>
                            )}
                          </select>
                        </div>

                        <div className="flex items-end">
                          {!isGrader ? (
                            <button
                              onClick={() => handleUpdateConfig(p.id, { isGradingPrimary: true })}
                              className="w-full py-2 px-3 rounded-xl bg-surface border border-surface-border hover:border-primary text-text-secondary hover:text-text-primary text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-2xs"
                            >
                              <Star className="w-3.5 h-3.5 text-text-muted" />
                              <span>Set as Primary Evaluator</span>
                            </button>
                          ) : (
                            <div className="w-full py-2 px-3 rounded-xl bg-primary-subtle border border-primary-border text-primary-text text-xs font-bold flex items-center justify-center space-x-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                              <span>Primary Evaluation Anchor</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Key Management Input & Actions */}
                      <div className="pt-2 border-t border-surface-border">
                        <label className="block text-[11px] font-bold text-text-secondary mb-1">
                          {hasKey ? 'Update Encrypted Key' : 'Enter API Key'}
                        </label>
                        <div className="flex space-x-2">
                          <div className="relative flex-1">
                            <Key className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5" />
                            <input
                              type="password"
                              placeholder={hasKey ? '••••••••••••••••••••••••' : 'Paste API key (AES-256 encrypted at rest)'}
                              value={keyInputs[p.id] || ''}
                              onChange={(e) =>
                                setKeyInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-surface-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-xs"
                            />
                          </div>

                          <button
                            onClick={() => handleSaveKey(p.id)}
                            disabled={savingKeyId === p.id || !keyInputs[p.id]}
                            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
                          >
                            {savingKeyId === p.id ? 'Encrypting...' : 'Save'}
                          </button>

                          {hasKey && (
                            <button
                              onClick={() => handleDeleteKey(p.id)}
                              className="p-2 rounded-xl bg-surface border border-surface-border hover:border-danger hover:text-danger text-text-muted transition-colors shrink-0"
                              title="Delete key"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleTestProvider(p.id)}
                            disabled={testingId === p.id}
                            className="px-3 py-2 rounded-xl bg-surface border border-surface-border hover:border-primary text-text-secondary hover:text-text-primary text-xs font-bold flex items-center space-x-1.5 transition-colors shrink-0 shadow-2xs"
                          >
                            <Activity className={`w-3.5 h-3.5 ${testingId === p.id ? 'animate-pulse text-primary' : ''}`} />
                            <span>{testingId === p.id ? 'Testing...' : 'Test'}</span>
                          </button>
                        </div>

                        {actionMessage && actionMessage.id === p.id && (
                          <div
                            className={`text-xs mt-2 px-3 py-1.5 rounded-xl flex items-center space-x-2 font-medium ${
                              actionMessage.isError
                                ? 'bg-danger-subtle text-danger-text border border-danger-border'
                                : 'bg-success-subtle text-success-text border border-success-border'
                            }`}
                          >
                            {actionMessage.isError ? (
                              <AlertCircle className="w-4 h-4 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                            )}
                            <span>{actionMessage.text}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Panel 2: Voice & Speech Audio */}
          {activeSettingsSection === 'voice' && (
            <div className="bg-surface rounded-3xl p-6 sm:p-7 border border-surface-border shadow-soft space-y-6">
              <div className="pb-3 border-b border-surface-border">
                <h3 className="text-base font-extrabold text-text-primary">Voice & Speech Coaching Experience</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Tune Socratic AI playback pace, accent clarity, and voice synthesis response cadence.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">
                    Speech Accent & Dialect
                  </label>
                  <select
                    value={voiceAccent}
                    onChange={(e) => setVoiceAccent(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-surface-border text-xs sm:text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-xs"
                  >
                    <option value="en-US">English (United States) — Senior Architect</option>
                    <option value="en-GB">English (United Kingdom) — Staff Engineer</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
                    <span className="font-bold">Playback Cadence & Speed</span>
                    <span className="text-primary font-mono font-black">{voiceSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.3"
                    step="0.1"
                    value={voiceSpeed}
                    onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted font-mono mt-1">
                    <span>0.8x (Reflective)</span>
                    <span>1.0x (Natural)</span>
                    <span>1.3x (Brisk)</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-surface-border flex items-center justify-between">
                  <span className="text-xs text-text-secondary font-medium">Test voice engine:</span>
                  <button
                    onClick={() => {
                      if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                        const utterance = new SpeechSynthesisUtterance(
                          "Welcome. Let's design a high-throughput, partitioned event queue with strict order guarantees."
                        );
                        utterance.rate = voiceSpeed;
                        utterance.lang = voiceAccent;
                        window.speechSynthesis.speak(utterance);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-primary-subtle hover:bg-primary-border text-primary-text border border-primary-border text-xs font-bold inline-flex items-center space-x-2 transition-all shadow-2xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play Sample Voice Prompt</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Panel 3: Storage & Offline Cache */}
          {activeSettingsSection === 'storage' && (
            <div className="bg-surface rounded-3xl p-6 sm:p-7 border border-surface-border shadow-soft space-y-6">
              <div className="pb-3 border-b border-surface-border">
                <h3 className="text-base font-extrabold text-text-primary">Storage, Privacy & Cache Management</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Manage local SQLite records, PWA service worker cache, and browser storage.
                </p>
              </div>

              <div className="space-y-4 text-xs text-text-secondary leading-relaxed">
                <div className="p-4 rounded-2xl bg-surface-subtle border border-surface-border space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-text-primary">
                    <Database className="w-4 h-4 text-success" />
                    <span>Local Database Architecture</span>
                  </div>
                  <p>
                    Mindset stores your session evaluations, radar rubrics, and SM-2 spaced repetition schedules locally in SQLite (<code className="bg-surface px-1.5 py-0.5 rounded text-primary">data/mindset.db</code>).
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-surface-subtle border border-surface-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold text-text-primary">
                      <RefreshCw className="w-4 h-4 text-primary" />
                      <span>Browser PWA Cache & Service Worker</span>
                    </div>
                    {cacheCleared && (
                      <span className="text-xs font-bold text-success-text bg-success-subtle px-2 py-0.5 rounded-full border border-success-border">
                        Purged!
                      </span>
                    )}
                  </div>
                  <p>
                    If you ever experience stale stylesheets or outdated cached bundles in local development, purge the browser cache storage and unregister background service workers with one click:
                  </p>
                  <button
                    onClick={handleClearCache}
                    className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-subtle border border-surface-border hover:border-danger hover:text-danger text-text-secondary text-xs font-bold transition-all shadow-2xs"
                  >
                    Purge Local Dev Cache & Service Workers
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Panel 4: Color Theme & Tokens */}
          {activeSettingsSection === 'theme' && (
            <div className="bg-surface rounded-3xl p-6 sm:p-7 border border-surface-border shadow-soft space-y-6">
              <div className="pb-3 border-b border-surface-border">
                <h3 className="text-base font-extrabold text-text-primary">Reusable Semantic Color Tokens</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Colors are completely decoupled from hardcoded literals and driven by CSS custom properties.
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-text-secondary leading-relaxed">
                  All views, cards, radar charts, and status indicators reference CSS variables defined in <code className="bg-surface-subtle px-2 py-0.5 rounded font-mono text-primary">apps/web/src/index.css</code>. Changing a single variable automatically rethemes the entire application:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-primary" />
                      <span className="text-xs font-bold text-text-primary">Primary</span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">var(--color-primary)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-secondary" />
                      <span className="text-xs font-bold text-text-primary">Secondary</span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">var(--color-secondary)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-tertiary" />
                      <span className="text-xs font-bold text-text-primary">Tertiary</span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">var(--color-tertiary)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-success" />
                      <span className="text-xs font-bold text-text-primary">Success</span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">var(--color-success)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-warning" />
                      <span className="text-xs font-bold text-text-primary">Warning</span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">var(--color-warning)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-danger" />
                      <span className="text-xs font-bold text-text-primary">Danger</span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">var(--color-danger)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
