'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  AccessLevel,
  Action,
  AuditRecord,
  BreakGlassRequest,
  OrganisationHierarchy,
  PermissionScope,
  Resource,
  RoleDefinition,
  StatCaseAlert,
  UserSession,
} from '../types/multiLevelRbac';
import {
  BUILT_IN_ROLES,
  INITIAL_USER_SESSION,
  SAMPLE_ORGANISATIONS,
  SAMPLE_STAT_ALERTS,
} from '../utils/multiLevelRbacDefaults';

interface MultiLevelAdminContextType {
  // Session & Identity
  session: UserSession;
  activeRole: RoleDefinition;
  organisations: OrganisationHierarchy[];
  activeOrg: OrganisationHierarchy;
  activeSite: OrganisationHierarchy['sites'][0];
  statAlerts: StatCaseAlert[];
  language: 'EN' | 'HI';
  setLanguage: (lang: 'EN' | 'HI') => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;

  // Navigation & Modules
  activeModule: Resource;
  setActiveModule: (m: Resource) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (c: boolean) => void;
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (o: boolean) => void;

  // Dynamic Permission Evaluators
  hasPermission: (resource: Resource, action: Action, requiredScope?: PermissionScope) => boolean;
  canAccessModule: (resource: Resource) => boolean;
  explainMissingPermission: (resource: Resource, action: Action) => string;

  // Switching Context
  switchOrganisation: (orgId: string) => void;
  switchSite: (siteId: string) => void;
  simulateRole: (roleId: string) => void;

  // Break-Glass & Sensitive Elevating
  elevatedAccessMinutesRemaining: number;
  cancelElevatedAccess: () => void;
  requestBreakGlass: (reason: string, durationMinutes: number, incidentTicket: string) => void;

  // Audit Logs
  auditLogs: AuditRecord[];
  addAuditLog: (entry: Omit<AuditRecord, 'id' | 'timestamp' | 'actorName' | 'actorRole' | 'actorEmail' | 'ipAddress'>) => void;

  // Approval Requests
  breakGlassRequests: BreakGlassRequest[];
  approveBreakGlass: (id: string) => void;
  rejectBreakGlass: (id: string) => void;
}

const MultiLevelAdminContext = createContext<MultiLevelAdminContextType | null>(null);

// Scope weight ranking for hierarchical evaluation
const SCOPE_WEIGHT: Record<PermissionScope, number> = {
  platform: 4,
  organisation: 3,
  site: 2,
  own: 1,
};

export function MultiLevelAdminProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession>(INITIAL_USER_SESSION);
  const [organisations] = useState<OrganisationHierarchy[]>(SAMPLE_ORGANISATIONS);
  const [activeModule, setActiveModule] = useState<Resource>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'HI'>('EN');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [statAlerts, setStatAlerts] = useState<StatCaseAlert[]>(SAMPLE_STAT_ALERTS);

  // Active Organisation & Site
  const activeOrg = useMemo(() => {
    return (
      organisations.find((o) => o.id === session.activeOrgId) || organisations[0]
    );
  }, [organisations, session.activeOrgId]);

  const activeSite = useMemo(() => {
    return (
      activeOrg.sites.find((s) => s.id === session.activeSiteId) || activeOrg.sites[0]
    );
  }, [activeOrg, session.activeSiteId]);

  // Break-glass countdown timer
  const [elevatedAccessMinutesRemaining, setElevatedAccessMinutesRemaining] = useState<number>(() => {
    if (!session.elevatedAccess?.isActive) return 0;
    const diffMs = new Date(session.elevatedAccess.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diffMs / (60 * 1000)));
  });

  useEffect(() => {
    if (!session.elevatedAccess?.isActive) {
      setElevatedAccessMinutesRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const diffMs = new Date(session.elevatedAccess!.expiresAt).getTime() - Date.now();
      const mins = Math.max(0, Math.floor(diffMs / (60 * 1000)));
      setElevatedAccessMinutesRemaining(mins);

      if (diffMs <= 0) {
        setSession((prev) => ({
          ...prev,
          elevatedAccess: undefined,
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session.elevatedAccess]);

  // Dynamic Permission Evaluator
  const hasPermission = useCallback(
    (resource: Resource, action: Action, requiredScope: PermissionScope = 'own'): boolean => {
      // 1. If elevated root break-glass access is active, bypass for platform-level emergency
      if (session.elevatedAccess?.isActive && session.level === 'level_0_platform') {
        return true;
      }

      const userRole = session.primaryRole;
      if (!userRole || !userRole.permissions) return false;

      // Find all permissions matching the requested resource & action
      const matchingPerms = userRole.permissions.filter(
        (p) =>
          p.resource === resource &&
          (p.action === action || p.action === 'update' && action === 'create')
      );

      if (matchingPerms.length === 0) return false;

      // Check if any matching permission scope satisfies or outranks requiredScope
      const reqWeight = SCOPE_WEIGHT[requiredScope];
      return matchingPerms.some((p) => SCOPE_WEIGHT[p.scope] >= reqWeight);
    },
    [session]
  );

  // Check if a module is viewable by the user
  const canAccessModule = useCallback(
    (resource: Resource): boolean => {
      if (session.elevatedAccess?.isActive) return true;
      const userRole = session.primaryRole;
      if (!userRole) return false;
      return userRole.permissions.some((p) => p.resource === resource);
    },
    [session]
  );

  // Tooltip explanation for disabled controls
  const explainMissingPermission = useCallback((resource: Resource, action: Action): string => {
    const roleName = session.primaryRole.name;
    const actionLabel = action.toUpperCase();
    return `Restricted: Role '${roleName}' does not hold [${resource}:${actionLabel}] permission. Contact Compliance or Platform Admin.`;
  }, [session]);

  // Context Switchers
  const switchOrganisation = useCallback(
    (orgId: string) => {
      const org = organisations.find((o) => o.id === orgId);
      if (!org) return;
      setSession((prev) => ({
        ...prev,
        activeOrgId: org.id,
        activeOrgName: org.name,
        activeSiteId: org.sites[0]?.id || '',
        activeSiteName: org.sites[0]?.name || '',
      }));
    },
    [organisations]
  );

  const switchSite = useCallback(
    (siteId: string) => {
      const site = activeOrg.sites.find((s) => s.id === siteId);
      if (!site) return;
      setSession((prev) => ({
        ...prev,
        activeSiteId: site.id,
        activeSiteName: site.name,
      }));
    },
    [activeOrg]
  );

  // Role Simulator
  const simulateRole = useCallback((roleId: string) => {
    const targetRole = BUILT_IN_ROLES.find((r) => r.id === roleId);
    if (!targetRole) return;

    setSession((prev) => {
      // If switching away from Platform staff, clear elevated break-glass
      const isPlatform = targetRole.level === 'level_0_platform';
      return {
        ...prev,
        level: targetRole.level,
        primaryRole: targetRole,
        elevatedAccess: isPlatform ? prev.elevatedAccess : undefined,
      };
    });
  }, []);

  const cancelElevatedAccess = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      elevatedAccess: undefined,
    }));
  }, []);

  // Initial audit records
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([
    {
      id: 'aud_9811',
      timestamp: '2026-10-13T12:50:22+05:30',
      actorName: 'Vikramaditya Sharma',
      actorRole: 'Platform Owner',
      actorEmail: 'v.sharma@mipaas.ai',
      action: 'breakglass:activate',
      resource: 'breakglass',
      scope: 'platform',
      ipAddress: '103.21.244.18 (New Delhi)',
      reason: 'Emergency Break-Glass: Investigating DICOM Ingest Stall on C-ECHO Gateway',
      diff: [
        { field: 'elevatedStatus', before: 'false', after: 'true' },
        { field: 'targetOrg', before: 'null', after: 'APOLLO-IN' },
      ],
    },
    {
      id: 'aud_9809',
      timestamp: '2026-10-13T11:34:10+05:30',
      actorName: 'Dr. Sarah Lin',
      actorRole: 'Clinical Governance Lead',
      actorEmail: 's.lin@mipaas.ai',
      action: 'thresholds:update',
      resource: 'thresholds',
      scope: 'organisation',
      ipAddress: '14.139.60.2 (Bengaluru)',
      reason: 'Recalibrated Lung Sybil-CT Sensitivity from 94.2% to 96.0% post-validation study',
      diff: [
        { field: 'sensitivity', before: 0.942, after: 0.960 },
        { field: 'secondApprover', before: 'pending', after: 'Dr. Anita Desai' },
      ],
    },
    {
      id: 'aud_9798',
      timestamp: '2026-10-13T09:12:45+05:30',
      actorName: 'Elena Rostova',
      actorRole: 'Compliance Officer (DPO)',
      actorEmail: 'e.rostova@apollo.internal',
      action: 'privacy_consent:erasure_request',
      resource: 'privacy_consent',
      scope: 'organisation',
      ipAddress: '49.207.211.5 (Delhi NCR)',
      reason: 'DPDP Act 2023 Sec 12 Right to Erasure for Patient P-0089. Statutory 3-year NMC retention applied to raw DICOM.',
      diff: [
        { field: 'phiIdentifiers', before: 'active', after: 'erased_and_pseudonymized' },
        { field: 'rawDicomArchive', before: 'retained', after: 'retained_nmc_statutory_3yr' },
      ],
    },
  ]);

  const addAuditLog = useCallback(
    (entry: Omit<AuditRecord, 'id' | 'timestamp' | 'actorName' | 'actorRole' | 'actorEmail' | 'ipAddress'>) => {
      const newRecord: AuditRecord = {
        ...entry,
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorName: session.name,
        actorRole: session.primaryRole.name,
        actorEmail: session.email,
        ipAddress: '127.0.0.1 (Internal Admin Session)',
      };
      setAuditLogs((prev) => [newRecord, ...prev]);
    },
    [session]
  );

  // Break-glass requests list
  const [breakGlassRequests, setBreakGlassRequests] = useState<BreakGlassRequest[]>([
    {
      id: 'bg_req_101',
      requesterName: 'Aditya Sen',
      requesterEmail: 'a.sen@mipaas.ai',
      targetOrg: 'Dr Lal PathLabs',
      targetScope: 'organisation',
      requestedRole: 'Ops / SRE (Root Elevated)',
      durationMinutes: 60,
      incidentTicket: 'INC-2026-8840',
      reason: 'PACS HL7 Gateway connection timeout on Rohini Regional Cluster. Need debug telemetry.',
      status: 'pending',
    },
  ]);

  const requestBreakGlass = useCallback(
    (reason: string, durationMinutes: number, incidentTicket: string) => {
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      setSession((prev) => ({
        ...prev,
        elevatedAccess: {
          isActive: true,
          reason,
          expiresAt,
          sponsor: 'Emergency Dual-Sign Off Protocol',
          ticketId: incidentTicket,
        },
      }));
      addAuditLog({
        action: 'breakglass:emergency_request',
        resource: 'breakglass',
        scope: 'platform',
        reason: `${incidentTicket}: ${reason}`,
      });
    },
    [addAuditLog]
  );

  const approveBreakGlass = useCallback(
    (id: string) => {
      setBreakGlassRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: 'approved', approver: session.name, approvedAt: new Date().toISOString() }
            : r
        )
      );
      addAuditLog({
        action: 'breakglass:approve',
        resource: 'breakglass',
        scope: 'platform',
        reason: `Approved break-glass request ${id}`,
      });
    },
    [addAuditLog, session.name]
  );

  const rejectBreakGlass = useCallback(
    (id: string) => {
      setBreakGlassRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r))
      );
      addAuditLog({
        action: 'breakglass:reject',
        resource: 'breakglass',
        scope: 'platform',
        reason: `Rejected break-glass request ${id}`,
      });
    },
    [addAuditLog]
  );

  return (
    <MultiLevelAdminContext.Provider
      value={{
        session,
        activeRole: session.primaryRole,
        organisations,
        activeOrg,
        activeSite,
        statAlerts,
        language,
        setLanguage,
        theme,
        setTheme,
        activeModule,
        setActiveModule,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileDrawerOpen,
        setMobileDrawerOpen,
        hasPermission,
        canAccessModule,
        explainMissingPermission,
        switchOrganisation,
        switchSite,
        simulateRole,
        elevatedAccessMinutesRemaining,
        cancelElevatedAccess,
        requestBreakGlass,
        auditLogs,
        addAuditLog,
        breakGlassRequests,
        approveBreakGlass,
        rejectBreakGlass,
      }}
    >
      {children}
    </MultiLevelAdminContext.Provider>
  );
}

export function useMultiLevelAdmin() {
  const ctx = useContext(MultiLevelAdminContext);
  if (!ctx) {
    throw new Error('useMultiLevelAdmin must be used within MultiLevelAdminProvider');
  }
  return ctx;
}
