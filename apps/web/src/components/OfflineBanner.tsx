import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-warning-subtle border-b border-warning-border px-4 py-2.5 text-center text-xs font-semibold text-warning-text flex items-center justify-center space-x-2 shadow-xs">
      <WifiOff className="w-3.5 h-3.5 text-warning" />
      <span>You are currently offline. Review cards and cached session history remain available.</span>
    </div>
  );
};
