'use client';

import React from 'react';
import { useRBAC } from '@/context/RBACContext';
import { Permission, Role, ROLE_DEFINITIONS } from '@/types/rbac';
import { Lock } from 'lucide-react';

interface PermissionGateProps {
  permission?: Permission;
  role?: Role | Role[];
  fallback?: React.ReactNode;
  showLockedBanner?: boolean;
  lockedTitle?: string;
  lockedMessage?: string;
  children: React.ReactNode;
}

export default function PermissionGate({
  permission,
  role,
  fallback,
  showLockedBanner = false,
  lockedTitle = 'Access Restricted by Role',
  lockedMessage,
  children,
}: PermissionGateProps) {
  const { hasPermission, hasRole, currentUser } = useRBAC();

  const isPermitted =
    (permission ? hasPermission(permission) : true) &&
    (role ? hasRole(role) : true);

  if (isPermitted) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showLockedBanner) {
    const meta = ROLE_DEFINITIONS[currentUser.role];
    const defaultMsg = permission
      ? `Your current role '${meta.title}' does not have the '${permission}' capability.`
      : `Action is restricted for role '${meta.title}'.`;

    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-left backdrop-blur-md">
        <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-xs md:text-sm">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>{lockedTitle}</span>
        </div>
        <p className="mt-1 text-xs text-gray-300">
          {lockedMessage || defaultMsg}
        </p>
      </div>
    );
  }

  return null;
}
