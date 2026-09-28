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
  gemini: 'Google Gemini',
  groq: 'Groq (Llama 3.3)',
  mistral: 'Mistral AI',
  cohere: 'Cohere Command R',
};

export const SettingsView: React.FC = () => {
  const [voiceAccent, setVoiceAccent] = useState('en-US');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);

  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [savingKeyId, setSavingKeyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; isError?: boolean } | null>(null);

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
        setActionMessage({ id, text: 'API key encrypted and saved securely!' });
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

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">System Settings</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure multi-provider AI fallbacks, circuit breakers, and audio preferences
        </p>
      </div>

      {/* Voice Preferences */}
      <div className="glass-card rounded-2xl p-5 border border-surface-border space-y-4">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-4 h-4 text-accent-cyan" />
          <h3 className="text-sm font-semibold text-white">Voice & Audio Coaching</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Voice Accent & Locale
            </label>
            <select
              value={voiceAccent}
              onChange={(e) => setVoiceAccent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-card border border-surface-border text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="en-US">English (United States) — Default</option>
              <option value="en-GB">English (United Kingdom)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Speech Playback Speed</span>
              <span className="text-white font-medium">{voiceSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.1"
              value={voiceSpeed}
              onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
              className="w-full accent-primary-500"
            />
          </div>
        </div>
      </div>

      {/* AI Providers & Fallback Pipeline */}
      <div className="glass-card rounded-2xl p-5 border border-surface-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-primary-400" />
            <h3 className="text-sm font-semibold text-white">AI Provider Routing & Keys</h3>
          </div>
          <button
            onClick={fetchProviders}
            disabled={loading}
            className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-surface-card border border-surface-border"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Requests automatically route through providers in priority order (P1 &rarr; P2 &rarr; P3 &rarr; P4). If a provider returns 429 quota exhaustion, it rests with exponential backoff. Three consecutive 5xx errors trip its circuit breaker for 60 seconds.
        </p>

        <div className="space-y-4 pt-1">
          {providers.map((p) => {
            const hasKey = p.hasKey;
            const isGrader = p.isGradingPrimary;
            const isCircuitOpen = p.circuitState === 'OPEN';
            const isResting = p.isResting;

            return (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-surface-card border border-surface-border space-y-3"
              >
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-dark border border-surface-border text-primary-300">
                      P{p.priority}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-white">
                          {PROVIDER_NAMES[p.id] || p.id}
                        </span>
                        {isGrader && (
                          <span className="flex items-center space-x-1 text-[10px] font-semibold text-accent-cyan px-2 py-0.5 rounded-full bg-accent-cyan/10 border border-accent-cyan/20">
                            <Star className="w-3 h-3 fill-accent-cyan" />
                            <span>Pinned Grader</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Active model: {p.model}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {/* Key status badge */}
                    {hasKey ? (
                      <span className="flex items-center space-x-1 text-[10px] font-medium text-accent-emerald px-2 py-0.5 rounded bg-accent-emerald/10 border border-accent-emerald/20">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Key Encrypted</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-accent-amber px-2 py-0.5 rounded bg-accent-amber/10 border border-accent-amber/20">
                        No Key (Mocked)
                      </span>
                    )}

                    {/* Circuit / Resting status */}
                    {isCircuitOpen ? (
                      <span className="text-[10px] font-bold text-accent-rose px-2 py-0.5 rounded bg-accent-rose/10 border border-accent-rose/20">
                        Circuit Open
                      </span>
                    ) : isResting ? (
                      <span className="text-[10px] font-medium text-accent-amber px-2 py-0.5 rounded bg-accent-amber/10 border border-accent-amber/20">
                        Resting (429)
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 px-1.5 py-0.5 rounded bg-surface-dark">
                        Ready
                      </span>
                    )}
                  </div>
                </div>

                {/* Model and Pinned Grader row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Select Model</label>
                    <select
                      value={p.model}
                      onChange={(e) => handleUpdateConfig(p.id, { model: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-surface-dark border border-surface-border text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                        className="w-full py-1.5 px-3 rounded-lg bg-surface-dark border border-surface-border hover:border-accent-cyan text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center space-x-1.5"
                      >
                        <Star className="w-3.5 h-3.5 text-slate-400" />
                        <span>Set as Pinned Grader</span>
                      </button>
                    ) : (
                      <div className="w-full py-1.5 px-3 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs font-semibold flex items-center justify-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Primary Evaluation Anchor</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* API Key management */}
                <div className="pt-2 border-t border-surface-border/50">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {hasKey ? 'Update Encrypted Key' : 'Enter API Key'}
                  </label>
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      <input
                        type="password"
                        placeholder={hasKey ? '••••••••••••••••••••••••' : 'Paste API key (AES-256 encrypted)'}
                        value={keyInputs[p.id] || ''}
                        onChange={(e) =>
                          setKeyInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-dark border border-surface-border text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <button
                      onClick={() => handleSaveKey(p.id)}
                      disabled={savingKeyId === p.id || !keyInputs[p.id]}
                      className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-xs font-medium"
                    >
                      {savingKeyId === p.id ? 'Encrypting...' : 'Save'}
                    </button>
                    {hasKey && (
                      <button
                        onClick={() => handleDeleteKey(p.id)}
                        className="p-1.5 rounded-lg bg-surface-dark border border-surface-border hover:border-accent-rose text-slate-400 hover:text-accent-rose"
                        title="Remove stored key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleTestProvider(p.id)}
                      disabled={testingId === p.id}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-dark border border-surface-border hover:border-surface-light text-slate-300 hover:text-white text-xs font-medium flex items-center space-x-1"
                    >
                      <Activity className={`w-3.5 h-3.5 ${testingId === p.id ? 'animate-pulse text-accent-cyan' : ''}`} />
                      <span>{testingId === p.id ? 'Testing...' : 'Test'}</span>
                    </button>
                  </div>

                  {actionMessage && actionMessage.id === p.id && (
                    <div
                      className={`text-[11px] mt-2 px-2.5 py-1 rounded flex items-center space-x-1.5 ${
                        actionMessage.isError
                          ? 'bg-accent-rose/10 text-accent-rose border border-accent-rose/20'
                          : 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20'
                      }`}
                    >
                      {actionMessage.isError ? (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
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

      {/* Security & Data Storage Card */}
      <div className="glass-card rounded-2xl p-5 border border-surface-border space-y-3 text-xs text-slate-400 leading-relaxed">
        <div className="flex items-center space-x-2 text-white font-semibold">
          <Database className="w-4 h-4 text-accent-emerald" />
          <h3 className="text-sm">Local-First Storage & Encryption</h3>
        </div>
        <p>
          All API keys are encrypted at rest using AES-256-GCM authenticated encryption. Your learning history, radar rubrics, and audio transcripts are saved in local SQLite. Zero cloud tracking or third-party analytics.
        </p>
      </div>
    </div>
  );
};
