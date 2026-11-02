import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile } from '../types/auth';
import { authApi } from '../api/auth';
import { hasPermission as checkPermission, hasRole as checkRole } from '../utils/permissions';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginUser: (user: UserProfile) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  can: (action: string, resource?: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.data?.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginUser = (userProfile: UserProfile) => {
    // Marking loading as finished avoids a brief unauthenticated bounce while
    // role/permission-derived UI re-renders with the new user profile.
    setIsLoading(false);
    setUser(userProfile);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout network errors
    } finally {
      setUser(null);
      window.location.href = '/signin';
    }
  };

  const can = useCallback(
    (action: string, resource: string = '*') => {
      return checkPermission(user, action, resource);
    },
    [user]
  );

  const hasRole = useCallback(
    (role: string | string[]) => {
      return checkRole(user, role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginUser,
        logout,
        refreshUser,
        can,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
