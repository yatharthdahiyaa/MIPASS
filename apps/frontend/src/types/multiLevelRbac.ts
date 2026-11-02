/**
 * MIPaaS Multi-Level Role-Based & Scope-Based Access Control (RBAC) System
 * Designed for Indian Diagnostic Laboratories, Hospital Networks & Platform SREs.
 * Compliant with India DPDP Act 2023, NABH digital audit standards, and DICOM/HL7/FHIR protocols.
 */

export type AccessLevel =
  | 'level_0_platform'     // Level 0: Platform (MIPaaS Staff)
  | 'level_1_organisation' // Level 1: Organisation (Diagnostic Chain / Hospital Network)
  | 'level_2_site'         // Level 2: Site / Department (Specific Hospital Branch or Lab Hub)
  | 'level_3_user';        // Level 3: Individual End Users (Clinician, Tech, Referrer, Auditor)

export type PermissionScope = 'platform' | 'organisation' | 'site' | 'own';

export type Resource =
  | 'overview'
  | 'organisations'
  | 'sites'
  | 'users'
  | 'roles'
  | 'approvals'
  | 'breakglass'
  | 'models'
  | 'agents'
  | 'thresholds'
  | 'clinical_ops'
  | 'privacy_consent'
  | 'integrations'
  | 'billing'
  | 'audit'
  | 'platform_health'
  | 'website_cms';

export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'review'
  | 'execute'
  | 'approve'
  | 'export'
  | 'breakglass';

export interface Permission {
  resource: Resource;
  action: Action;
  scope: PermissionScope;
  isRisky?: boolean;
  riskDescription?: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  level: AccessLevel;
  levelLabel: string;
  description: string;
  isBuiltIn: boolean; // Built-in roles are read-only and cloneable
  permissions: Permission[];
  userCount: number;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  level: AccessLevel;
  primaryRole: RoleDefinition;
  rolesAtScopes: {
    roleId: string;
    roleName: string;
    scope: PermissionScope;
    targetId: string;   // e.g. 'org_apollo_01' or 'site_delhi_hub'
    targetName: string; // e.g. 'Apollo Diagnostics India'
  }[];
  activeOrgId: string;
  activeOrgName: string;
  activeSiteId: string;
  activeSiteName: string;
  isMfaVerified: boolean;
  lastLogin: string;
  elevatedAccess?: {
    isActive: boolean;
    reason: string;
    expiresAt: string; // ISO string for countdown
    sponsor: string;
    ticketId: string;
  };
}

export interface OrganisationHierarchy {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'suspended' | 'trial';
  tier: 'Enterprise' | 'Hospital Network' | 'Diagnostic Chain';
  sites: {
    id: string;
    name: string;
    city: string;
    state: string;
    pacsAeTitle: string;
    activeCasesToday: number;
    statQueueDepth: number;
    status: 'online' | 'degraded' | 'offline';
  }[];
}

export interface StatCaseAlert {
  id: string;
  caseId: string;
  patientSyntheticId: string; // Synthetic ID e.g. P-0001
  modality: 'CT' | 'MRI' | 'XR';
  finding: string;
  urgency: 'STAT_CRITICAL' | 'URGENT' | 'ROUTINE';
  siteName: string;
  elapsedMinutes: number;
  slaLimitMinutes: number;
}

export interface ModelCatalogueItem {
  id: string;
  name: string;
  modality: string;
  version: string;
  status: 'validated' | 'in_shadow' | 'disabled';
  accuracyMetric: string; // e.g., 'AUC 0.982'
  sensitivity: number;
  specificity: number;
  orgEnabled: boolean;
  lastThresholdUpdate: string;
  requiresTwoPersonApproval: boolean;
}

export interface AiAgentItem {
  id: string;
  name: string;
  code: string;
  autonomyLevel: 'L0_assistive' | 'L1_semi_autonomous' | 'L2_autonomous';
  autonomyLabel: string;
  description: string;
  enabled: boolean;
  lastTrained: string;
  safetyGuardrails: string[];
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  actorEmail: string;
  action: string;
  resource: string;
  scope: PermissionScope;
  ipAddress: string;
  reason?: string;
  diff?: {
    field: string;
    before: unknown;
    after: unknown;
  }[];
}

export interface BreakGlassRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  targetOrg: string;
  targetScope: PermissionScope;
  requestedRole: string;
  durationMinutes: number;
  incidentTicket: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approver?: string;
  approvedAt?: string;
}
