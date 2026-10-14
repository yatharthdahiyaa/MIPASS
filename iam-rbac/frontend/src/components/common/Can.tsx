import React from 'react';
import { useAuth } from '../../context/AuthContext';

interface CanProps {
  permission?: string;
  action?: string;
  resource?: string;
  children: React.ReactNode;
  fallback?: 'disable' | React.ReactNode;
  disableOnly?: boolean;
}

export function Can({
  permission,
  action,
  resource = '*',
  children,
  fallback = null,
  disableOnly = false,
}: CanProps) {
  const { can } = useAuth();
  const targetPermission = action || permission || '';
  const isAllowed = can(targetPermission, resource);

  if (isAllowed) {
    return <>{children}</>;
  }

  const shouldDisable = disableOnly || fallback === 'disable';

  if (shouldDisable && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      disabled: true,
      className: `${(children as any).props.className || ''} opacity-50 cursor-not-allowed pointer-events-none`,
      title: `Requires '${targetPermission}' permission`,
    });
  }

  return <>{typeof fallback === 'string' && fallback === 'disable' ? null : fallback}</>;
}
