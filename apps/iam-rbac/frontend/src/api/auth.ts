import { apiRequest } from './client';
import { UserProfile } from '../types/auth';

export const authApi = {
  signup: (data: { email: string; password: string; confirmPassword: string; accountName: string; accountAlias?: string }) =>
    apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

  verifyEmail: (token: string) =>
    apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),

  signinStep1: (data: { userType: 'root' | 'iam'; email?: string; accountIdOrAlias?: string; username?: string }) =>
    apiRequest('/auth/signin/step1', { method: 'POST', body: JSON.stringify(data) }),

  signinStep2: (data: { userType: 'root' | 'iam'; email?: string; accountIdOrAlias?: string; username?: string; password: string; rememberDevice?: boolean }) =>
    apiRequest('/auth/signin/step2', { method: 'POST', body: JSON.stringify(data) }),

  mfaVerify: (data: { mfaSessionToken: string; code: string; isBackupCode?: boolean }) =>
    apiRequest('/auth/mfa/verify', { method: 'POST', body: JSON.stringify(data) }),

  mfaSetup: () =>
    apiRequest('/auth/mfa/setup', { method: 'POST' }),

  mfaEnable: (code: string) =>
    apiRequest('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ code }) }),

  logout: () =>
    apiRequest('/auth/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (data: { token: string; newPassword: string; confirmPassword: string }) =>
    apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),

  getMe: (): Promise<{ success: boolean; data: { user: UserProfile } }> =>
    apiRequest('/auth/me', { method: 'GET' }),
};
