import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, setup, setupRequired } = useAuth();
  const [passphrase, setPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setError('Please enter your passphrase.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const result = setupRequired ? await setup(passphrase.trim()) : await login(passphrase.trim());
    if (!result.success) {
      setError(result.error || (setupRequired ? 'Setup failed' : 'Authentication failed'));
      setIsSubmitting(false);
    }
  };

  const handleQuickUnlock = async (phrase: string) => {
    setPassphrase(phrase);
    setError(null);
    setIsSubmitting(true);
    const result = setupRequired ? await setup(phrase) : await login(phrase);
    if (!result.success) {
      setError(result.error || 'Authentication failed');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-surface rounded-2xl p-6 sm:p-8 shadow-card border border-surface-border card-primary-glow">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-subtle border border-primary-border text-primary mb-3 shadow-xs">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-extrabold text-text-primary tracking-tight">
              {setupRequired ? 'First-Run Setup' : 'Welcome Back'}
            </h1>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
              {setupRequired
                ? 'Choose your master passphrase (e.g. zayn or zayn123) to initialize your workspace'
                : 'Enter your master passphrase to unlock your coaching workspace'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="passphrase" className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Master Passphrase
                </label>
              </div>
              <div className="relative">
                <input
                  id="passphrase"
                  type={showPassword ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter passphrase (e.g. zayn)"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-surface-border text-sm text-text-primary placeholder:text-text-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-danger-subtle border border-danger-border text-danger-text text-xs leading-relaxed font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold flex items-center justify-center space-x-2 shadow-primary hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{setupRequired ? 'Initializing Workspace...' : 'Unlocking...'}</span>
                </>
              ) : (
                <>
                  <span>{setupRequired ? 'Initialize Workspace' : 'Unlock Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Quick Actions for Ease of Use */}
            <div className="pt-3 flex flex-col items-center space-y-2.5 border-t border-surface-border">
              <button
                type="button"
                onClick={() => handleQuickUnlock('zayn')}
                disabled={isSubmitting}
                className="w-full py-2 px-3 text-xs font-bold text-primary-text hover:text-primary rounded-xl bg-primary-subtle border border-primary-border hover:bg-primary-border flex items-center justify-center space-x-2 transition-all shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Quick Unlock with &apos;zayn&apos;</span>
              </button>

              {!setupRequired && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/v1/auth/dev-reset', { method: 'POST' });
                      if (res.ok) {
                        window.location.reload();
                      }
                    } catch {
                      // ignore
                    }
                  }}
                  className="text-[11px] text-text-muted hover:text-primary underline transition-colors"
                >
                  Reset Workspace (Start Fresh Setup)
                </button>
              )}
            </div>
          </form>

          {/* Security Note */}
          <div className="mt-6 pt-4 border-t border-surface-border flex items-start space-x-2 text-[11px] text-text-muted">
            <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <span>
              Protected by Argon2id cryptographic hashing with constant-time verification against timing attacks.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
