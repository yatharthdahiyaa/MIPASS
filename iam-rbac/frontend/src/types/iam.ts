export interface IamUser {
  id: string;
  username: string;
  email: string;
  isRoot: boolean;
  isSuspended: boolean;
  isMfaEnabled: boolean;
  failedLoginAttempts: number;
  isLocked: boolean;
  createdAt: string;
  roles: { id: string; name: string }[];
  groups: { id: string; name: string }[];
}

export interface IamRole {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  userCount: number;
  groupCount: number;
  policies: { id: string; name: string; description?: string }[];
}

export interface IamPolicy {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  document: {
    Version?: string;
    Statement: {
      Effect: 'Allow' | 'Deny';
      Action: string[];
      Resource: string[];
    }[];
  };
  attachedRolesCount: number;
  createdAt: string;
}

export interface IamGroup {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  roles: { id: string; name: string }[];
  users: { id: string; username: string }[];
}

export interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  effect: 'ALLOW' | 'DENY' | 'INFO' | 'WARN';
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  user?: { id: string; username: string; email: string } | null;
  details?: Record<string, any>;
}
