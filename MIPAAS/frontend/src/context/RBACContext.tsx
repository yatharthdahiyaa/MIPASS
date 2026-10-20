'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AuditLogEntry,
  CLINICAL_PERSONAS,
  Permission,
  Role,
  ROLE_DEFINITIONS,
  UserProfile,
} from '@/types/rbac';
import { iamAuthService, IamUserResult } from '@/services/iamAuthService';

interface RBACContextType {
  currentUser: UserProfile;
  currentRole: Role;
  availableRoles: Role[];
  switchRole: (role: Role) => void;
  switchPersona: (personaId: string) => void;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: Role | Role[]) => boolean;
  auditLogs: AuditLogEntry[];
  addAuditLog: (
    action: string,
    resource: string,
    decision: 'allow' | 'deny',
    details?: Record<string, unknown>,
  ) => void;
  isRBACModalOpen: boolean;
  setRBACModalOpen: (open: boolean) => void;
  // Session Authentication status
  isAuthenticated: boolean;
  logout: () => void;
  // IAM Authentication Integration
  iamUser: IamUserResult | null;
  isIamAuthenticated: boolean;
  loginWithIAM: (user: IamUserResult) => void;
  logoutIAM: () => Promise<void>;
}

const RBACContext = createContext<RBACContextType | undefined>(undefined);

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-01',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toLocaleTimeString(),
    userId: 'admin-01',
    userName: 'Arthur Davis',
    role: 'admin',
    action: 'rbac:policy_sync',
    resource: 'gcp:iam_workload_identity',
    decision: 'allow',
    details: { roles_synced: 5, perimeter: 'VPC-SC-US-CENTRAL1' },
  },
  {
    id: 'log-02',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toLocaleTimeString(),
    userId: 'tech-01',
    userName: 'Marcus Chen',
    role: 'technician',
    action: 'upload:signed_url_generated',
    resource: 'gcs://mipaas-data/raw/tech-01/series_091',
    decision: 'allow',
    details: { scanner: 'Siemens SOMATOM Force', slices: 384 },
  },
  {
    id: 'log-03',
    timestamp: new Date(Date.now() - 1000 * 60 * 7).toLocaleTimeString(),
    userId: 'res-01',
    userName: 'Dr. Sarah Lin',
    role: 'researcher',
    action: 'xai:gradcam_batch_inspect',
    resource: 'xai/sybil_nlst_cohort_03',
    decision: 'allow',
    details: { phi_masked: true, study_count: 42 },
  },
  {
    id: 'log-04',
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toLocaleTimeString(),
    userId: 'rad-01',
    userName: 'Dr. Elena Vance',
    role: 'radiologist',
    action: 'session:authenticated',
    resource: 'app:clinical_workstation',
    decision: 'allow',
    details: { department: 'Thoracic Imaging' },
  },
];

export function RBACProvider({ children }: { children: React.ReactNode }) {
  // Default to Radiologist persona
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => CLINICAL_PERSONAS['rad-01']);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mipaas_session_active') === 'true';
    }
    return false;
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [isRBACModalOpen, setRBACModalOpen] = useState(false);
  const [iamUser, setIamUser] = useState<IamUserResult | null>(null);

  // Restore saved IAM user from URL SSO param or localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const ssoUserParam = urlParams.get('sso_user');
        if (ssoUserParam) {
          try {
            const parsed = JSON.parse(decodeURIComponent(atob(ssoUserParam))) as IamUserResult;
            setIamUser(parsed);
            setCurrentUser(iamAuthService.mapIamUserToClinicalProfile(parsed));
            localStorage.setItem('mipaas_iam_user', JSON.stringify(parsed));
            // Clean up the URL query param without full page reload
            urlParams.delete('sso_user');
            const newSearch = urlParams.toString();
            const cleanUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
            window.history.replaceState({}, '', cleanUrl);
            return;
          } catch {
            // fallback to local storage
          }
        }
      }

      const savedIam = localStorage.getItem('mipaas_iam_user');
      if (savedIam) {
        const parsed = JSON.parse(savedIam) as IamUserResult;
        setIamUser(parsed);
        setCurrentUser(iamAuthService.mapIamUserToClinicalProfile(parsed));
        return;
      }
      const savedPersonaId = localStorage.getItem('mipaas_active_persona');
      if (savedPersonaId && CLINICAL_PERSONAS[savedPersonaId]) {
        setCurrentUser(CLINICAL_PERSONAS[savedPersonaId]);
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const addAuditLog = useCallback(
    (
      action: string,
      resource: string,
      decision: 'allow' | 'deny',
      details?: Record<string, unknown>,
    ) => {
      const newEntry: AuditLogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        userId: currentUser.id,
        userName: currentUser.name,
        role: currentUser.role,
        action,
        resource,
        decision,
        details,
      };
      setAuditLogs((prev) => [newEntry, ...prev.slice(0, 49)]);
    },
    [currentUser]
  );

  const switchPersona = useCallback(
    (personaId: string) => {
      const persona = CLINICAL_PERSONAS[personaId];
      if (!persona) return;

      const previousRole = currentUser.role;
      setCurrentUser(persona);
      setIsAuthenticated(true);

      try {
        localStorage.setItem('mipaas_active_persona', personaId);
        localStorage.setItem('mipaas_session_active', 'true');
      } catch {
        // Ignore localStorage write errors
      }

      addAuditLog(
        'rbac:persona_switched',
        `user:${persona.id}`,
        'allow',
        { from_role: previousRole, to_role: persona.role, user_name: persona.name }
      );
    },
    [currentUser, addAuditLog]
  );

  const switchRole = useCallback(
    (role: Role) => {
      // Find matching persona for this role
      const matchingPersona = Object.values(CLINICAL_PERSONAS).find((p) => p.role === role);
      if (matchingPersona) {
        switchPersona(matchingPersona.id);
      } else {
        // Fallback: update role on current profile
        const updated: UserProfile = {
          ...currentUser,
          role,
          roleTitle: ROLE_DEFINITIONS[role].title,
          permissions: ROLE_DEFINITIONS[role].permissions,
        };
        setCurrentUser(updated);
        addAuditLog(
          'rbac:role_updated',
          `user:${currentUser.id}`,
          'allow',
          { target_role: role }
        );
      }
    },
    [currentUser, switchPersona, addAuditLog]
  );

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      // Admin always has all permissions
      if (currentUser.role === 'admin') return true;

      const rolePerms = ROLE_DEFINITIONS[currentUser.role]?.permissions || [];
      const hasDirect = rolePerms.includes(permission);

      if (hasDirect) return true;

      // JOBS_READ_ALL implies JOBS_READ
      if (permission === 'jobs:read' && rolePerms.includes('jobs:read_all')) {
        return true;
      }

      return false;
    },
    [currentUser]
  );

  const hasRole = useCallback(
    (role: Role | Role[]): boolean => {
      if (Array.isArray(role)) {
        return role.includes(currentUser.role);
      }
      return currentUser.role === role;
    },
    [currentUser]
  );

  const loginWithIAM = useCallback(
    (user: IamUserResult) => {
      setIamUser(user);
      const clinicalProfile = iamAuthService.mapIamUserToClinicalProfile(user);
      setCurrentUser(clinicalProfile);
      setIsAuthenticated(true);
      try {
        localStorage.setItem('mipaas_iam_user', JSON.stringify(user));
        localStorage.setItem('mipaas_session_active', 'true');
        localStorage.removeItem('mipaas_active_persona');
      } catch {
        // ignore
      }
      addAuditLog(
        'auth:iam_login_success',
        `iam:user/${user.isRoot ? 'root' : user.username}`,
        'allow',
        {
          account_id: user.accountId,
          is_root: user.isRoot,
          iam_roles: user.roles,
          clinical_role: clinicalProfile.role,
        }
      );
    },
    [addAuditLog]
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setIamUser(null);
    try {
      localStorage.removeItem('mipaas_session_active');
      localStorage.removeItem('mipaas_active_persona');
      localStorage.removeItem('mipaas_iam_user');
    } catch {
      // ignore
    }
  }, []);

  const logoutIAM = useCallback(async () => {
    try {
      await iamAuthService.logout();
      localStorage.removeItem('mipaas_iam_user');
      localStorage.removeItem('mipaas_session_active');
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setIamUser(null);
    setCurrentUser(CLINICAL_PERSONAS['rad-01']);
    addAuditLog('auth:iam_logout', 'iam:session', 'allow');
  }, [addAuditLog]);

  return (
    <RBACContext.Provider
      value={{
        currentUser,
        currentRole: currentUser.role,
        availableRoles: ['doctor', 'patient', 'radiologist', 'technician', 'researcher', 'admin', 'auditor'],
        switchRole,
        switchPersona,
        hasPermission,
        hasRole,
        auditLogs,
        addAuditLog,
        isRBACModalOpen,
        setRBACModalOpen,
        isAuthenticated,
        logout,
        iamUser,
        isIamAuthenticated: !!iamUser,
        loginWithIAM,
        logoutIAM,
      }}
    >
      {children}
    </RBACContext.Provider>
  );
}

export function useRBAC(): RBACContextType {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within an RBACProvider');
  }
  return context;
}
