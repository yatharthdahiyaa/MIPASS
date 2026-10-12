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
    details?: Record<string, any>
  ) => void;
  isRBACModalOpen: boolean;
  setRBACModalOpen: (open: boolean) => void;
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
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [isRBACModalOpen, setRBACModalOpen] = useState(false);

  // Restore saved persona from localStorage if available
  useEffect(() => {
    try {
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
      details?: Record<string, any>
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

      try {
        localStorage.setItem('mipaas_active_persona', personaId);
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

  return (
    <RBACContext.Provider
      value={{
        currentUser,
        currentRole: currentUser.role,
        availableRoles: ['radiologist', 'technician', 'researcher', 'admin', 'auditor'],
        switchRole,
        switchPersona,
        hasPermission,
        hasRole,
        auditLogs,
        addAuditLog,
        isRBACModalOpen,
        setRBACModalOpen,
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
