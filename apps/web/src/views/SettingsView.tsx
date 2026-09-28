import React, { useState } from 'react';
import { Volume2, Database, Cpu, CheckCircle2 } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [voiceAccent, setVoiceAccent] = useState('en-US');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);

  const providers = [
    { id: 'gemini', name: 'Google Gemini', status: 'Primary Grader', priority: 1 },
    { id: 'groq', name: 'Groq (Llama 3.3)', status: 'Fallback / Fast', priority: 2 },
    { id: 'mistral', name: 'Mistral Large', status: 'Available', priority: 3 },
    { id: 'cohere', name: 'Cohere Command R+', status: 'Available', priority: 4 },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">System Settings</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure AI providers, voice synthesis, and encryption keys
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

      {/* AI Providers Overview */}
      <div className="glass-card rounded-2xl p-5 border border-surface-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-primary-400" />
            <h3 className="text-sm font-semibold text-white">Multi-Provider AI Fallback</h3>
          </div>
          <span className="text-[10px] text-accent-emerald font-semibold px-2 py-0.5 rounded-full bg-accent-emerald/10 border border-accent-emerald/20">
            Dynamic Discovery
          </span>
        </div>

        <div className="space-y-2">
          {providers.map((p) => (
            <div
              key={p.id}
              className="p-3 rounded-xl bg-surface-card border border-surface-border flex items-center justify-between"
            >
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
                <div>
                  <div className="text-xs font-semibold text-white">{p.name}</div>
                  <div className="text-[10px] text-slate-400">Priority #{p.priority} · {p.status}</div>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">P{p.priority}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security & Data Storage */}
      <div className="glass-card rounded-2xl p-5 border border-surface-border space-y-3 text-xs text-slate-400 leading-relaxed">
        <div className="flex items-center space-x-2 text-white font-semibold">
          <Database className="w-4 h-4 text-primary-400" />
          <span>Local Storage & Zero Cloud Leakage</span>
        </div>
        <p>
          All learning history, transcripts, and evaluation metrics are stored in a local WAL-mode SQLite database. API keys are encrypted at rest with AES-256-GCM.
        </p>
      </div>
    </div>
  );
};
