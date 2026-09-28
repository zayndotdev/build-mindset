import React from 'react';
import { Brain, BookOpen, BarChart3, Settings } from 'lucide-react';

export type TabType = 'coach' | 'topics' | 'progress' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'coach' as TabType, label: 'Coach', icon: Brain },
    { id: 'topics' as TabType, label: 'Topics', icon: BookOpen },
    { id: 'progress' as TabType, label: 'Progress', icon: BarChart3 },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-surface-border/80 px-2 py-1.5 sm:py-2">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-200 relative ${
                isActive
                  ? 'text-primary-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1.5 w-8 h-1 bg-gradient-to-r from-primary-500 to-accent-cyan rounded-full shadow-sm shadow-primary-500/50" />
              )}
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
