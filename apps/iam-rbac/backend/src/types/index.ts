import { Request } from 'express';

export type PolicyEffect = 'Allow' | 'Deny';

export interface PolicyStatement {
  Effect: PolicyEffect;
  Action: string[];
  Resource: string[];
}

export interface PolicyDocument {
  Version?: string;
  Statement: PolicyStatement[];
}

export interface TokenPayload {
  userId: string;
  accountId: string;
  username: string;
  email: string;
  isRoot: boolean;
  type: 'access' | 'refresh' | 'mfa_pending';
}

export interface AuthUserContext {
  id: string;
  accountId: string;
  username: string;
  email: string;
  isRoot: boolean;
  roles: string[];
  permissions: string[];
  policies: PolicyDocument[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserContext;
}

export interface AuditLogInput {
  accountId: string;
  userId?: string | null;
  action: string;
  resource: string;
  effect: 'ALLOW' | 'DENY' | 'INFO' | 'WARN';
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}
