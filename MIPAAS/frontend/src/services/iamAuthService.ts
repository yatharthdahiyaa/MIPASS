/**
 * AWS IAM & RBAC Authentication Service Client for MiPAAS
 * Communicates with the Node.js/Express IAM Backend with automatic proxy rewrite and direct fallback.
 */

import { Permission, Role, ROLE_DEFINITIONS, UserProfile } from '@/types/rbac';

export interface IamUserResult {
  id: string;
  accountId: string;
  accountName: string;
  accountAlias?: string;
  username: string;
  email: string;
  isRoot: boolean;
  isMfaEnabled?: boolean;
  roles: string[];
  permissions: string[];
}

export interface Step1Response {
  success: boolean;
  data?: {
    userType: 'root' | 'iam';
    identifier: string;
    accountName: string;
    accountId?: string;
    accountAlias?: string;
    requiresMfa: boolean;
  };
  error?: string;
  message?: string;
}

export interface Step2Response {
  success: boolean;
  requiresMfa?: boolean;
  mfaSessionToken?: string;
  data?: {
    user: IamUserResult;
  };
  error?: string;
  message?: string;
}

export interface MfaVerifyResponse {
  success: boolean;
  data?: {
    user: IamUserResult;
  };
  error?: string;
  message?: string;
}

/**
 * Resilient fetcher: Tries direct localhost:5000 first (with CORS enabled on backend),
 * and falls back to Next.js proxy /api/iam-auth if needed.
 */
async function iamFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const directUrl = `http://localhost:5000${path}`;
  const proxyUrl = `/api/iam-auth${path}`;

  try {
    const res = await fetch(directUrl, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    });
    return res;
  } catch {
    // If direct fails (e.g. browser CORS or network sandbox), try Next.js proxy rewrite
    if (typeof window !== 'undefined') {
      return await fetch(proxyUrl, options);
    }
    throw new Error('IAM backend is unreachable on port 5000');
  }
}

export const iamAuthService = {
  /**
   * Check if IAM Backend service is running
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await iamFetch('/health', { method: 'GET' });
      const data = await res.json();
      return res.ok && data.status === 'healthy';
    } catch {
      return false;
    }
  },

  /**
   * Step 1: Identifier check (Root email or IAM Account + Username)
   */
  async signinStep1(payload: {
    userType: 'root' | 'iam';
    email?: string;
    accountIdOrAlias?: string;
    username?: string;
  }): Promise<Step1Response> {
    const res = await iamFetch('/auth/signin/step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Incorrect credentials. Please verify your information.');
    }
    return data;
  },

  /**
   * Step 2: Password verification
   */
  async signinStep2(payload: {
    userType: 'root' | 'iam';
    email?: string;
    accountIdOrAlias?: string;
    username?: string;
    password: string;
    rememberDevice?: boolean;
  }): Promise<Step2Response> {
    const res = await iamFetch('/auth/signin/step2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      const errorObj = new Error(data.message || 'Incorrect credentials.');
      (errorObj as any).error = data.error;
      (errorObj as any).status = res.status;
      throw errorObj;
    }
    return data;
  },

  /**
   * Step 3: MFA TOTP / Backup code verification
   */
  async verifyMfa(payload: {
    mfaSessionToken: string;
    code: string;
    isBackupCode?: boolean;
  }): Promise<MfaVerifyResponse> {
    const res = await iamFetch('/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Invalid verification code.');
    }
    return data;
  },

  /**
   * Get authenticated user profile via cookie
   */
  async getMe(): Promise<{ success: boolean; data?: { user: IamUserResult } }> {
    const res = await iamFetch('/auth/me', {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) return { success: false };
    return await res.json();
  },

  /**
   * Terminate active IAM session
   */
  async logout(): Promise<void> {
    try {
      await iamFetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout
    }
  },

  /**
   * Maps an authenticated IAM user to a MiPAAS Clinical Persona & Permissions
   */
  mapIamUserToClinicalProfile(iamUser: IamUserResult): UserProfile {
    let mappedRole: Role = 'researcher';
    const rolesLower = (iamUser.roles || []).map((r) => r.toLowerCase());

    if (iamUser.isRoot || rolesLower.includes('root') || rolesLower.includes('admin')) {
      mappedRole = 'admin';
    } else if (
      rolesLower.some((r) => r.includes('rad') || r.includes('doctor') || r.includes('physician'))
    ) {
      mappedRole = 'radiologist';
    } else if (
      rolesLower.some((r) => r.includes('tech') || r.includes('nurse') || r.includes('ops'))
    ) {
      mappedRole = 'technician';
    } else if (
      rolesLower.some((r) => r.includes('audit') || r.includes('billing') || r.includes('readonly'))
    ) {
      mappedRole = 'auditor';
    } else {
      // Developer / Default IAM user
      mappedRole = 'researcher';
    }

    const roleMeta = ROLE_DEFINITIONS[mappedRole];

    // Build permissions list: take all clinical role permissions, or if Root/Admin grant all
    const permissions: Permission[] =
      mappedRole === 'admin'
        ? [
            'jobs:create',
            'jobs:read',
            'jobs:read_all',
            'jobs:delete',
            'results:read',
            'xai:read',
            'reports:sign',
            'reports:export',
            'models:read',
            'models:manage',
            'models:benchmark',
            'users:manage',
            'audit:read',
            'phi:read',
          ]
        : [...roleMeta.permissions];

    const displayName = iamUser.isRoot
      ? `Root User (${iamUser.email.split('@')[0]})`
      : iamUser.username
          .split('.')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');

    return {
      id: iamUser.id,
      name: displayName,
      email: iamUser.email,
      role: mappedRole,
      roleTitle: iamUser.isRoot
        ? 'AWS Root Superuser'
        : `${roleMeta.title} (${iamUser.roles.join(', ') || 'IAM'})`,
      department: iamUser.isRoot ? 'Cloud Infrastructure' : 'Clinical AI Operations',
      organization: iamUser.accountName || 'AWS Healthcare Cloud',
      permissions,
    };
  },
};
