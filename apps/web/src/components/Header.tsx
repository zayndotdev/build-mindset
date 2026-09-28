import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Brain, LogOut } from 'lucide-react';

export const Header: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const [systemHealthy, setSystemHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        const res = await fetch('/readyz');
        if (mounted) {
          setSystemHealthy(res.ok);
        }
      } catch {
        if (mounted) {
          setSystemHealthy(false);
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-surface-border/80 px-4 py-3 sm:px-6">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-cyan p-0.5 shadow-lg shadow-primary-500/20">
            <div className="w-full h-full bg-background rounded-[10px] flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-500" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-white">Mindset</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-400 border border-primary-500/20">
                v0.1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Voice-First System Design & Senior Eng Coaching
            </p>
          </div>
        </div>

        {/* Right Status Actions */}
        <div className="flex items-center space-x-3">
          {/* Health Pill */}
          <div className="hidden xs:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-card border border-surface-border">
            {systemHealthy === true ? (
              <>
                <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse"></span>
                <span className="text-slate-300">Ready</span>
              </>
            ) : systemHealthy === false ? (
              <>
                <span className="w-2 h-2 rounded-full bg-accent-rose"></span>
                <span className="text-accent-rose">Degraded</span>
              </>
            ) : (
              <span className="text-slate-500">Checking...</span>
            )}
          </div>

          {/* User Logout Button if authenticated */}
          {isAuthenticated && (
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
