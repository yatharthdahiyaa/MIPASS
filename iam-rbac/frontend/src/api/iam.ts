import { apiRequest } from './client';
import { IamUser, IamRole, IamPolicy, IamGroup, AuditLogItem } from '../types/iam';

export const iamApi = {
  // Users
  getUsers: (): Promise<{ success: boolean; data: IamUser[] }> =>
    apiRequest('/users', { method: 'GET' }),

  createUser: (data: { username: string; email: string; password: string; roleIds?: string[]; groupIds?: string[] }) =>
    apiRequest('/users', { method: 'POST', body: JSON.stringify(data) }),

  getUser: (id: string) =>
    apiRequest(`/users/${id}`, { method: 'GET' }),

  updateUser: (id: string, data: { email?: string; isSuspended?: boolean; roleIds?: string[]; groupIds?: string[] }) =>
    apiRequest(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteUser: (id: string) =>
    apiRequest(`/users/${id}`, { method: 'DELETE' }),

  resetUserPassword: (id: string, newPassword: string) =>
    apiRequest(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),

  // Roles
  getRoles: (): Promise<{ success: boolean; data: IamRole[] }> =>
    apiRequest('/roles', { method: 'GET' }),

  createRole: (data: { name: string; description?: string; policyIds?: string[] }) =>
    apiRequest('/roles', { method: 'POST', body: JSON.stringify(data) }),

  updateRole: (id: string, data: { name?: string; description?: string; policyIds?: string[] }) =>
    apiRequest(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteRole: (id: string) =>
    apiRequest(`/roles/${id}`, { method: 'DELETE' }),

  // Policies
  getPolicies: (): Promise<{ success: boolean; data: IamPolicy[] }> =>
    apiRequest('/policies', { method: 'GET' }),

  createPolicy: (data: { name: string; description?: string; document: any }) =>
    apiRequest('/policies', { method: 'POST', body: JSON.stringify(data) }),

  updatePolicy: (id: string, data: { name?: string; description?: string; document?: any }) =>
    apiRequest(`/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deletePolicy: (id: string) =>
    apiRequest(`/policies/${id}`, { method: 'DELETE' }),

  // Groups
  getGroups: (): Promise<{ success: boolean; data: IamGroup[] }> =>
    apiRequest('/groups', { method: 'GET' }),

  createGroup: (data: { name: string; description?: string; roleIds?: string[]; userIds?: string[] }) =>
    apiRequest('/groups', { method: 'POST', body: JSON.stringify(data) }),

  updateGroup: (id: string, data: { name?: string; description?: string; roleIds?: string[]; userIds?: string[] }) =>
    apiRequest(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteGroup: (id: string) =>
    apiRequest(`/groups/${id}`, { method: 'DELETE' }),

  // Audit Logs
  getAuditLogs: (params: { page?: number; limit?: number; action?: string; effect?: string } = {}): Promise<{
    success: boolean;
    data: { logs: AuditLogItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } };
  }> => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.action) query.append('action', params.action);
    if (params.effect) query.append('effect', params.effect);

    return apiRequest(`/audit-logs?${query.toString()}`, { method: 'GET' });
  },
};
