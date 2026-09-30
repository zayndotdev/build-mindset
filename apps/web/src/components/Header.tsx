import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Brain, LogOut } from 'lucide-react';
import { TabType, NAV_TABS } from './Navigation';

interface HeaderProps {
  activeTab?: TabType;
  onSelectTab?: (tab: TabType) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onSelectTab }) => {
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
    <header className="sticky top-0 z-40 w-full bg-surface/95 backdrop-blur-md border-b border-surface-border px-4 py-2.5 sm:px-6 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-primary p-0.5 shadow-md shadow-primary/20">
            <div className="w-full h-full bg-surface rounded-[10px] flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base tracking-tight text-text-primary">Mindset</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-subtle text-primary-text border border-primary-border">
                v0.1
              </span>
            </div>
            <p className="text-[11px] text-text-muted font-medium hidden lg:block">
              Voice-First System Design & Senior Eng Coaching
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        {isAuthenticated && onSelectTab && activeTab && (
          <nav
            className="hidden md:flex items-center bg-surface-subtle p-1 rounded-xl border border-surface-border shadow-2xs"
            role="tablist"
            aria-label="Desktop Primary Navigation"
          >
            {NAV_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs transition-all ${
                    isActive
                      ? 'bg-surface text-primary shadow-xs font-bold border border-surface-border'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface/50 font-semibold'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-text-muted'}`} />
                  <span>{tab.shortLabel || tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Right Status Actions */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* Health Pill */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-subtle border border-surface-border">
            {systemHealthy === true ? (
              <>
                <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                <span className="text-success-text">Ready</span>
              </>
            ) : systemHealthy === false ? (
              <>
                <span className="w-2 h-2 rounded-full bg-danger"></span>
                <span className="text-danger-text">Degraded</span>
              </>
            ) : (
              <span className="text-text-muted">Checking...</span>
            )}
          </div>

          {/* User Logout Button if authenticated */}
          {isAuthenticated && (
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="flex items-center space-x-1.5 text-xs font-semibold text-text-secondary hover:text-primary px-3 py-1.5 rounded-lg hover:bg-primary-subtle border border-transparent hover:border-primary-border transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
