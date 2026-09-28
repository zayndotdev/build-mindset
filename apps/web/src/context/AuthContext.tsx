import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  setupRequired: boolean;
  user: User | null;
  login: (passphrase: string) => Promise<{ success: boolean; error?: string }>;
  setup: (passphrase: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [setupRequired, setSetupRequired] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      // First check if first-run setup is required
      const statusRes = await fetch('/api/v1/auth/status', {
        headers: { Accept: 'application/json' },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.data?.setupRequired) {
          setSetupRequired(true);
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
          return;
        }
      }

      setSetupRequired(false);
      const res = await fetch('/api/v1/auth/me', {
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setUser(data.user);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch {
      // Network error or offline
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const setup = async (passphrase: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });

      const data = await res.json();

      if (res.ok) {
        setSetupRequired(false);
        setIsAuthenticated(true);
        setUser(data.user || data.data?.user);
        return { success: true };
      } else {
        return {
          success: false,
          error: data.error?.message || 'Passphrase setup failed. Please try again.',
        };
      }
    } catch {
      return {
        success: false,
        error: 'Unable to connect to the server. Check your connection.',
      };
    }
  };

  const login = async (passphrase: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsAuthenticated(true);
        setUser(data.user);
        return { success: true };
      } else {
        return {
          success: false,
          error: data.error?.message || 'Login failed. Please check your passphrase.',
        };
      }
    } catch {
      return {
        success: false,
        error: 'Unable to connect to the server. Check your connection.',
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        setupRequired,
        user,
        login,
        setup,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
