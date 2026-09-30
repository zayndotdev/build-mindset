import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { Navigation, TabType } from './components/Navigation';
import { LoginView } from './views/LoginView';
import { CoachView } from './views/CoachView';
import { TopicsView } from './views/TopicsView';
import { ProgressView } from './views/ProgressView';
import { SettingsView } from './views/SettingsView';
import { Loader2 } from 'lucide-react';

const AuthenticatedApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('coach');

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-800">
      <Header activeTab={activeTab} onSelectTab={setActiveTab} />
      <OfflineBanner />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12">
        {activeTab === 'coach' && <CoachView onNavigateToTopics={() => setActiveTab('topics')} />}
        {activeTab === 'topics' && <TopicsView />}
        {activeTab === 'progress' && <ProgressView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
      <Navigation activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  );
};

const MainContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-3 bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs text-text-muted font-medium">Checking credentials...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <LoginView />
        </main>
      </div>
    );
  }

  return <AuthenticatedApp />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
};

export default App;
