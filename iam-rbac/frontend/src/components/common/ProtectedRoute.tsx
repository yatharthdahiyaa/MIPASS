import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  role?: string | string[];
}

export function ProtectedRoute({ children, permission, role }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, can, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-aws-lightbg dark:bg-aws-darkBg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-aws-orange border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Loading AWS Management Console...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // Check role requirement
  if (role && !hasRole(role)) {
    return <Navigate to="/access-denied" state={{ requiredRole: role, from: location }} replace />;
  }

  // Check permission requirement
  if (permission && !can(permission)) {
    return <Navigate to="/access-denied" state={{ requiredPermission: permission, from: location }} replace />;
  }

  return <>{children}</>;
}
