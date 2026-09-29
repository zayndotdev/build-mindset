import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

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

    if (setupRequired && passphrase.trim().length < 8) {
      setError('Passphrase must be at least 8 characters long.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const result = setupRequired ? await setup(passphrase) : await login(passphrase);
    if (!result.success) {
      setError(result.error || (setupRequired ? 'Setup failed' : 'Authentication failed'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl border border-surface-border">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-500/10 border border-primary-500/20 text-primary-400 mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {setupRequired ? 'First-Run Setup' : 'Welcome Back'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {setupRequired
                ? 'Create a secure master passphrase (min 8 chars) to initialize your workspace'
                : 'Enter your master passphrase to unlock your coaching workspace'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="passphrase" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Master Passphrase
                </label>
                {setupRequired && (
                  <span className={`text-[11px] font-medium ${passphrase.length >= 8 ? 'text-accent-emerald' : 'text-slate-400'}`}>
                    {passphrase.length >= 8 ? '✓ 8+ chars' : `${passphrase.length}/8 min chars`}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="passphrase"
                  type={showPassword ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder={setupRequired ? 'Enter at least 8 characters' : 'Enter your passphrase'}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-card border border-surface-border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-accent-rose/10 border border-accent-rose/30 text-accent-rose text-xs leading-relaxed">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white text-sm font-semibold flex items-center justify-center space-x-2 shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{setupRequired ? 'Initializing Security...' : 'Verifying...'}</span>
                </>
              ) : (
                <>
                  <span>{setupRequired ? 'Create Master Passphrase' : 'Unlock Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {!setupRequired && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Reset local workspace passphrase? This allows you to set a new passphrase on your local machine.')) {
                      try {
                        const res = await fetch('/api/v1/auth/dev-reset', { method: 'POST' });
                        if (res.ok) {
                          window.location.reload();
                        }
                      } catch {
                        // ignore
                      }
                    }
                  }}
                  className="text-[11px] text-slate-500 hover:text-primary-400 underline transition-colors"
                >
                  Reset local passphrase (dev mode)
                </button>
              </div>
            )}
          </form>

          {/* Security Note */}
          <div className="mt-6 pt-5 border-t border-surface-border/60 flex items-start space-x-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
            <span>
              Protected by Argon2id cryptographic hashing with constant-time verification against timing attacks.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
