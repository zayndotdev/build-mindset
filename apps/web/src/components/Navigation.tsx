import React from 'react';
import { Brain, BookOpen, BarChart3, Settings } from 'lucide-react';

export type TabType = 'coach' | 'topics' | 'progress' | 'settings';

export const NAV_TABS = [
  { id: 'coach' as TabType, label: 'Coach', icon: Brain },
  { id: 'topics' as TabType, label: 'Curriculum Topics', shortLabel: 'Topics', icon: BookOpen },
  { id: 'progress' as TabType, label: 'Progress & Skills', shortLabel: 'Progress', icon: BarChart3 },
  { id: 'settings' as TabType, label: 'System Settings', shortLabel: 'Settings', icon: Settings },
];

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab }) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-surface-border px-2 py-1.5 shadow-card"
      role="navigation"
      aria-label="Bottom Mobile Navigation"
    >
      <div className="max-w-md mx-auto flex items-center justify-around" role="tablist" aria-label="Main Views">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={`${tab.label} View`}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all duration-200 relative min-h-[44px] ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-text-muted hover:text-text-primary font-medium'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1.5 w-8 h-1 bg-primary rounded-full shadow-primary" />
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
