export type UserType = 'root' | 'iam';

export interface UserProfile {
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
  policies?: any[];
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
