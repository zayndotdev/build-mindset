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

const MainContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('coach');

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Checking credentials...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <>
      <main className="max-w-xl mx-auto px-4 py-5 sm:px-6">
        {activeTab === 'coach' && <CoachView onNavigateToTopics={() => setActiveTab('topics')} />}
        {activeTab === 'topics' && <TopicsView />}
        {activeTab === 'progress' && <ProgressView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
      <Navigation activeTab={activeTab} onSelectTab={setActiveTab} />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-background text-slate-100">
        <Header />
        <OfflineBanner />
        <MainContent />
      </div>
    </AuthProvider>
  );
};

export default App;
