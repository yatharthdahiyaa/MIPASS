'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authApi, type MfaChallenge, type RegisterInput, type SessionUser } from './api';
import { ROLE_DEFINITIONS, asRole, type Permission, type Role } from './roles';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface SessionContextValue {
  status: Status;
  user: SessionUser | null;
  /** Resolves to the user, or to an MFA challenge that `completeMfa` must finish. */
  signIn: (identifier: string, password: string, remember: boolean) => Promise<SessionUser | MfaChallenge>;
  completeMfa: (mfaToken: string, code: string) => Promise<SessionUser>;
  signUp: (input: RegisterInput) => Promise<SessionUser>;
  /** Adopt a user object returned by an account endpoint (verification, reset, profile). */
  setUser: (user: SessionUser) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Holds the central-database session for the whole app (cookie-backed; see lib/auth/api.ts). */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  const apply = useCallback((next: SessionUser | null) => {
    setUser(next);
    setStatus(next ? 'authenticated' : 'anonymous');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await authApi.session();
      apply(s.authenticated ? s.user : null);
    } catch {
      apply(null);
    }
  }, [apply]);

  // Initial session lookup (cookie is sent automatically; ignore late results after unmount).
  useEffect(() => {
    let cancelled = false;
    authApi.session().then(
      (s) => !cancelled && apply(s.authenticated ? s.user : null),
      () => !cancelled && apply(null),
    );
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user,
      refresh,
      setUser: apply,
      signIn: async (identifier, password, remember) => {
        const res = await authApi.login(identifier, password, remember);
        if ('mfa_required' in res) return res;
        apply(res.user);
        return res.user;
      },
      completeMfa: async (mfaToken, code) => {
        const { user: u } = await authApi.mfaVerify(mfaToken, code);
        apply(u);
        return u;
      },
      signUp: async (input) => {
        const { user: u } = await authApi.register(input);
        apply(u);
        return u;
      },
      signOut: async () => {
        try {
          await authApi.logout();
        } finally {
          apply(null);
        }
      },
    }),
    [status, user, refresh, apply],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

export interface AccessUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleTitle: string;
}

const GUEST: AccessUser = { id: 'guest', name: 'Guest', email: '', role: 'guest', roleTitle: 'Guest' };

/**
 * Permission helpers for product screens. The backend re-checks every request;
 * this only decides what to show.
 */
export function useAccess() {
  const { status, user, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  return useMemo(() => {
    const role = asRole(user?.role);
    const currentUser: AccessUser = user
      ? { id: user.id, name: user.name, email: user.email, role, roleTitle: user.role_title || ROLE_DEFINITIONS[role].title }
      : GUEST;
    const granted = new Set(user?.permissions ?? []);

    return {
      currentUser,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      hasPermission: (permission: Permission) => granted.has(permission),
      hasRole: (roles: Role | Role[]) => (Array.isArray(roles) ? roles : [roles]).includes(role),
      /** Records a clinical action in the central audit log (no-op when signed out). */
      addAuditLog: (action: string, resource: string, decision: 'allow' | 'deny', details?: Record<string, unknown>) => {
        if (status !== 'authenticated') return;
        void authApi.audit({ action, resource, decision, details }).catch(() => undefined);
      },
      requestSignIn: () => router.push(`/login?next=${encodeURIComponent(pathname || '/')}`),
      signOut,
    };
  }, [status, user, router, pathname, signOut]);
}
