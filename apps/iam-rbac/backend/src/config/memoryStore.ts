/**
 * Resilient In-Memory Store for AWS IAM & RBAC Service
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
