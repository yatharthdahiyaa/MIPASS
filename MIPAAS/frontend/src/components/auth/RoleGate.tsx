'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, ShieldAlert } from 'lucide-react';
import { useRBAC } from '@/context/RBACContext';
import type { Role } from '@/types/rbac';

interface RoleGateProps {
  allowedRoles: Role[];
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function RoleGate({ allowedRoles, title, description, children }: RoleGateProps) {
  const { currentUser, isAuthenticated, isSessionReady } = useRBAC();

  if (!isSessionReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="w-4 h-4 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          <span>Verifying access...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser?.id) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-5 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <Lock className="h-8 w-8" />
          </div>
          <div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
              Restricted Console
            </span>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F9D9A] px-5 py-3 text-sm font-bold text-white hover:bg-[#0D8B88]"
          >
            <Lock className="h-4 w-4" />
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-5 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
              Access Restricted
            </span>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">
              You are signed in as {currentUser.name} ({currentUser.role}). This console requires one of these roles: {allowedRoles.join(', ')}.
            </p>
          </div>
          <Link href="/" className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
