/**
 * Resilient In-Memory & Seed Store for AWS IAM & RBAC Service
 * Used automatically as a high-availability fallback when PostgreSQL is offline.
 */

import { PolicyDocument } from '../types';

export interface MemoryAccount {
  id: string;
  name: string;
  accountAlias: string | null;
  rootUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryUser {
  id: string;
  accountId: string;
  username: string;
  email: string;
  passwordHash: string;
  isRoot: boolean;
  isSuspended: boolean;
  isMfaEnabled: boolean;
  forcePasswordReset: boolean;
  failedLoginAttempts: number;
  lockUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryRole {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryPolicy {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  document: PolicyDocument;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryGroup {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryUserRole {
  id: string;
  userId: string;
  roleId: string;
  assignedAt: Date;
}

export interface MemoryRolePolicy {
  id: string;
  roleId: string;
  policyId: string;
  attachedAt: Date;
}

export interface MemoryUserGroup {
  id: string;
  userId: string;
  groupId: string;
  assignedAt: Date;
}

export interface MemoryGroupRole {
  id: string;
  groupId: string;
  roleId: string;
  assignedAt: Date;
}

export interface MemoryRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  isRevoked: boolean;
  replacedByToken: string | null;
  createdAt: Date;
}

export interface MemoryMfaSecret {
  id: string;
  userId: string;
  secret: string;
  backupCodes: string[];
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryAuditLog {
  id: string;
  accountId: string;
  userId: string | null;
  action: string;
  resource: string;
  effect: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: any;
  timestamp: Date;
}

export interface MemoryPasswordReset {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

export interface MemoryEmailVerification {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  isVerified: boolean;
  createdAt: Date;
}

export class MemoryStore {
  accounts: MemoryAccount[] = [];
  users: MemoryUser[] = [];
  roles: MemoryRole[] = [];
  policies: MemoryPolicy[] = [];
  groups: MemoryGroup[] = [];
  userRoles: MemoryUserRole[] = [];
  rolePolicies: MemoryRolePolicy[] = [];
  userGroups: MemoryUserGroup[] = [];
  groupRoles: MemoryGroupRole[] = [];
  refreshTokens: MemoryRefreshToken[] = [];
  mfaSecrets: MemoryMfaSecret[] = [];
  auditLogs: MemoryAuditLog[] = [];
  passwordResets: MemoryPasswordReset[] = [];
  emailVerifications: MemoryEmailVerification[] = [];

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    const now = new Date();

    // 1. Seed Accounts (Support both 123456789012 and aliases aws-demo, aws-prod)
    const account1: MemoryAccount = {
      id: '123456789012',
      name: 'AWS Healthcare Cloud Org',
      accountAlias: 'aws-demo',
      rootUserId: 'usr_root_001',
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.push(account1);

    // 2. Policies
    const adminPolicy: MemoryPolicy = {
      id: 'pol_admin_001',
      accountId: account1.id,
      name: 'AdministratorAccess',
      description: 'Provides full administrative access across all AWS and MiPAAS services.',
      document: {
        Version: '2026-10-17',
        Statement: [{ Effect: 'Allow', Action: ['*'], Resource: ['*'] }],
      },
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    const userMgmtPolicy: MemoryPolicy = {
      id: 'pol_iam_002',
      accountId: account1.id,
      name: 'UserAndRoleManagement',
      description: 'Allows managing users, groups, roles and viewing audit trails.',
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['users:*', 'roles:*', 'policies:*', 'groups:*', 'audit:*'],
            Resource: ['*'],
          },
        ],
      },
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    const devPolicy: MemoryPolicy = {
      id: 'pol_dev_003',
      accountId: account1.id,
      name: 'DeveloperAccess',
      description: 'Allows reading and writing application resources, models, and execution jobs.',
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'resources:*',
              'compute:*',
              'storage:*',
              'database:*',
              'users:read',
              'jobs:*',
              'results:*',
            ],
            Resource: ['*'],
          },
          {
            Effect: 'Deny',
            Action: ['billing:*'],
            Resource: ['*'],
          },
        ],
      },
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    const billingPolicy: MemoryPolicy = {
      id: 'pol_bill_004',
      accountId: account1.id,
      name: 'BillingAccess',
      description: 'Provides full access to billing, invoices, payment methods, and cost analysis.',
      document: {
        Version: '2026-10-17',
        Statement: [{ Effect: 'Allow', Action: ['billing:*'], Resource: ['*'] }],
      },
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    const readOnlyPolicy: MemoryPolicy = {
      id: 'pol_read_005',
      accountId: account1.id,
      name: 'ReadOnlyAccess',
      description: 'Provides read-only access to all services and resources.',
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['*:read', '*:list', '*:describe', '*:get'],
            Resource: ['*'],
          },
        ],
      },
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    // MiPAAS Clinical & Healthcare Policies
    const radPolicy: MemoryPolicy = {
      id: 'pol_rad_006',
      accountId: account1.id,
      name: 'ClinicalRadiologyAccess',
      description: 'Consultant Radiologist rights for CT/MRI triage, Sybil AI inference, XAI inspect, and report signing.',
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['scans:*', 'inference:run', 'xai:inspect', 'reports:sign', 'reports:create', 'jobs:*'],
            Resource: ['*'],
          },
        ],
      },
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    const techPolicy: MemoryPolicy = {
      id: 'pol_tech_007',
      accountId: account1.id,
      name: 'ImagingTechnicianAccess',
      description: 'Diagnostic Lab Technician rights for DICOM uploads, C-STORE PACS pushes, and scanner modality routing.',
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['scans:upload', 'scans:view', 'pacs:query', 'pacs:store', 'dicom:export', 'jobs:create'],
            Resource: ['*'],
          },
        ],
      },
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    const resPolicy: MemoryPolicy = {
      id: 'pol_res_008',
      accountId: account1.id,
      name: 'ClinicalResearcherAccess',
      description: 'Medical AI research evaluation on anonymized cohorts and ROC benchmark validation.',
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['models:evaluate', 'xai:inspect', 'scans:view_anonymized', 'benchmarks:read'],
            Resource: ['*'],
          },
        ],
      },
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    const govPolicy: MemoryPolicy = {
      id: 'pol_gov_009',
      accountId: account1.id,
      name: 'ClinicalGovernanceAccess',
      description: 'Clinical Director authority for model validation, threshold adjustment, and 2-person approvals.',
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['models:approve', 'thresholds:update', 'agents:configure', 'audit:*', 'breakglass:*'],
            Resource: ['*'],
          },
        ],
      },
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    const dpdpPolicy: MemoryPolicy = {
      id: 'pol_dpdp_010',
      accountId: account1.id,
      name: 'DPDPComplianceAccess',
      description: 'Data Protection Officer role for India DPDP Act 2023, consent tracking, and NMC 3-year statutory retention audits.',
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['consent:*', 'erasure:audit', 'audit:read', 'breach:report', 'compliance:export'],
            Resource: ['*'],
          },
        ],
      },
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    this.policies.push(
      adminPolicy,
      userMgmtPolicy,
      devPolicy,
      billingPolicy,
      readOnlyPolicy,
      radPolicy,
      techPolicy,
      resPolicy,
      govPolicy,
      dpdpPolicy
    );

    // 3. Roles
    const roleRoot: MemoryRole = {
      id: 'role_root',
      accountId: account1.id,
      name: 'Root',
      description: 'Account Owner with unconstrained superuser privileges.',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };
    const roleAdmin: MemoryRole = {
      id: 'role_admin',
      accountId: account1.id,
      name: 'Admin',
      description: 'Administrator capable of managing users, roles, groups, and audit logs.',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };
    const roleDev: MemoryRole = {
      id: 'role_dev',
      accountId: account1.id,
      name: 'Developer',
      description: 'Software engineer with access to compute and clinical AI operations.',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };
    const roleBilling: MemoryRole = {
      id: 'role_billing',
      accountId: account1.id,
      name: 'Billing',
      description: 'Finance specialist with access to invoices and subscription billing.',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };
    const roleReadOnly: MemoryRole = {
      id: 'role_readonly',
      accountId: account1.id,
      name: 'ReadOnly',
      description: 'Auditor or compliance officer with inspection capabilities.',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };
    const roleRadiologist: MemoryRole = {
      id: 'role_radiologist',
      accountId: account1.id,
      name: 'Radiologist',
      description: 'Consultant Radiologist with scan review, AI inference, and report signing authority.',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };
    const roleTechnician: MemoryRole = {
      id: 'role_technician',
      accountId: account1.id,
      name: 'Technician',
      description: 'Imaging Technician with scanner upload and DICOM PACS routing authority.',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };
    const roleResearcher: MemoryRole = {
      id: 'role_researcher',
      accountId: account1.id,
      name: 'Researcher',
      description: 'Medical AI Researcher with anonymized dataset evaluation & XAI analysis.',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };
    const roleClinicalLead: MemoryRole = {
      id: 'role_clinical_lead',
      accountId: account1.id,
      name: 'ClinicalLead',
      description: 'Clinical Director with model threshold and ROC curve sign-off rights.',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };
    const roleDPO: MemoryRole = {
      id: 'role_dpo',
      accountId: account1.id,
      name: 'ComplianceOfficer',
      description: 'Data Protection Officer responsible for India DPDP Act 2023 compliance.',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };

    this.roles.push(
      roleRoot,
      roleAdmin,
      roleDev,
      roleBilling,
      roleReadOnly,
      roleRadiologist,
      roleTechnician,
      roleResearcher,
      roleClinicalLead,
      roleDPO
    );

    // Attach Policies to Roles
    this.rolePolicies.push(
      { id: 'rp_1', roleId: roleRoot.id, policyId: adminPolicy.id, attachedAt: now },
      { id: 'rp_2', roleId: roleAdmin.id, policyId: userMgmtPolicy.id, attachedAt: now },
      { id: 'rp_3', roleId: roleDev.id, policyId: devPolicy.id, attachedAt: now },
      { id: 'rp_4', roleId: roleBilling.id, policyId: billingPolicy.id, attachedAt: now },
      { id: 'rp_5', roleId: roleReadOnly.id, policyId: readOnlyPolicy.id, attachedAt: now },
      { id: 'rp_6', roleId: roleRadiologist.id, policyId: radPolicy.id, attachedAt: now },
      { id: 'rp_7', roleId: roleTechnician.id, policyId: techPolicy.id, attachedAt: now },
      { id: 'rp_8', roleId: roleResearcher.id, policyId: resPolicy.id, attachedAt: now },
      { id: 'rp_9', roleId: roleClinicalLead.id, policyId: govPolicy.id, attachedAt: now },
      { id: 'rp_10', roleId: roleDPO.id, policyId: dpdpPolicy.id, attachedAt: now }
    );

    // 4. Seed Users
    // Root: root@aws-example.com (Password: SuperSecret#Root2026! or AdminRoot@123456)
    const rootUser: MemoryUser = {
      id: 'usr_root_001',
      accountId: account1.id,
      username: 'root',
      email: 'root@aws-example.com',
      passwordHash: '$2a$10$9Jy3G4ron4xrxHtHL1ZFU.7Sw.59I5yioupLiIYKUUgAAAq5En09G',
      isRoot: true,
      isSuspended: false,
      isMfaEnabled: false,
      forcePasswordReset: false,
      failedLoginAttempts: 0,
      lockUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    // IAM User: alice.dev @ aws-demo (Password: DeveloperPass#2026! or AliceDev@123456)
    const aliceUser: MemoryUser = {
      id: 'usr_alice_002',
      accountId: account1.id,
      username: 'alice.dev',
      email: 'alice@company.internal',
      passwordHash: '$2a$10$bj9JLXsmVMex46awGL0i6uhdT5a0B0idWyb0pq6N82XqslXXj9njG',
      isRoot: false,
      isSuspended: false,
      isMfaEnabled: false,
      forcePasswordReset: false,
      failedLoginAttempts: 0,
      lockUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    // MiPAAS Clinician: elena.vance @ aws-demo (Password: Rad!0l0gist#2026)
    const elenaUser: MemoryUser = {
      id: 'usr_rad_003',
      accountId: account1.id,
      username: 'elena.vance',
      email: 'elena.vance@mipaas.health',
      passwordHash: '$2a$10$radVanceElena2026ClinicalHash0001',
      isRoot: false,
      isSuspended: false,
      isMfaEnabled: false,
      forcePasswordReset: false,
      failedLoginAttempts: 0,
      lockUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    // MiPAAS Technician: marcus.chen @ aws-demo (Password: T3chCT$can#2026)
    const marcusUser: MemoryUser = {
      id: 'usr_tech_004',
      accountId: account1.id,
      username: 'marcus.chen',
      email: 'marcus.chen@mipaas.health',
      passwordHash: '$2a$10$techChenMarcus2026ClinicalHash0002',
      isRoot: false,
      isSuspended: false,
      isMfaEnabled: false,
      forcePasswordReset: false,
      failedLoginAttempts: 0,
      lockUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    // MiPAAS Researcher: sarah.lin @ aws-demo (Password: R3s34rch!AI#2026)
    const sarahUser: MemoryUser = {
      id: 'usr_res_005',
      accountId: account1.id,
      username: 'sarah.lin',
      email: 'sarah.lin@mipaas.research',
      passwordHash: '$2a$10$resLinSarah2026ClinicalHash0003',
      isRoot: false,
      isSuspended: false,
      isMfaEnabled: false,
      forcePasswordReset: false,
      failedLoginAttempts: 0,
      lockUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    // MiPAAS Admin: arthur.davis @ aws-demo (Password: Adm!nS3cur3#2026)
    const arthurUser: MemoryUser = {
      id: 'usr_admin_006',
      accountId: account1.id,
      username: 'arthur.davis',
      email: 'arthur.davis@mipaas.health',
      passwordHash: '$2a$10$adminDavisArthur2026ClinicalHash0004',
      isRoot: false,
      isSuspended: false,
      isMfaEnabled: false,
      forcePasswordReset: false,
      failedLoginAttempts: 0,
      lockUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    // MiPAAS Compliance DPO: a.pendelton @ aws-demo (Password: Aud!tC0mply#2026)
    const pendeltonUser: MemoryUser = {
      id: 'usr_aud_007',
      accountId: account1.id,
      username: 'a.pendelton',
      email: 'a.pendelton@mipaas.health',
      passwordHash: '$2a$10$audPendelton2026ClinicalHash0005',
      isRoot: false,
      isSuspended: false,
      isMfaEnabled: false,
      forcePasswordReset: false,
      failedLoginAttempts: 0,
      lockUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    this.users.push(rootUser, aliceUser, elenaUser, marcusUser, sarahUser, arthurUser, pendeltonUser);

    // Assign Roles
    this.userRoles.push(
      { id: 'ur_root', userId: rootUser.id, roleId: roleRoot.id, assignedAt: now },
      { id: 'ur_alice', userId: aliceUser.id, roleId: roleDev.id, assignedAt: now },
      { id: 'ur_elena', userId: elenaUser.id, roleId: roleRadiologist.id, assignedAt: now },
      { id: 'ur_marcus', userId: marcusUser.id, roleId: roleTechnician.id, assignedAt: now },
      { id: 'ur_sarah', userId: sarahUser.id, roleId: roleResearcher.id, assignedAt: now },
      { id: 'ur_arthur', userId: arthurUser.id, roleId: roleAdmin.id, assignedAt: now },
      { id: 'ur_arthur_lead', userId: arthurUser.id, roleId: roleClinicalLead.id, assignedAt: now },
      { id: 'ur_pendelton', userId: pendeltonUser.id, roleId: roleDPO.id, assignedAt: now }
    );

    // 5. Seed Initial Audit Log
    this.auditLogs.push({
      id: 'audit_init_001',
      accountId: account1.id,
      userId: rootUser.id,
      action: 'account:initial_setup',
      resource: `account:${account1.id}`,
      effect: 'ALLOW',
      ipAddress: '127.0.0.1',
      userAgent: 'MiPAAS RBAC Service Seed',
      details: { message: 'Cloud IAM organization initialized with system roles and policies.' },
      timestamp: now,
    });
  }

  // Helper to attach nested relations to user
  attachUserRelations(user: MemoryUser | null, include?: any) {
    if (!user) return null;
    const res: any = { ...user };
    if (include?.account) {
      res.account = this.accounts.find((a) => a.id === user.accountId) || null;
    }
    return res;
  }
}
