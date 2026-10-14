import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, ExternalLink, HelpCircle } from 'lucide-react';

export function AccessDeniedPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const state = (location.state as { requiredPermission?: string; requiredRole?: string; from?: any }) || {};
  const requiredPermission = state.requiredPermission || 'iam:*';
  const accountId = user?.accountId || '123456789012';
  const username = user?.username || 'user';

  const userArn = user?.isRoot
    ? `arn:aws:iam::${accountId}:root`
    : `arn:aws:iam::${accountId}:user/${username}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="p-2.5 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-lg">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            403 - Access Denied
          </h1>
          <p className="text-xs text-gray-500">
            AWS Identity and Access Management (IAM) Policy Evaluation
          </p>
        </div>
      </div>

      {/* Main Error Box (AWS styled) */}
      <div className="bg-white dark:bg-aws-darkCard border-l-4 border-l-red-600 border border-gray-200 dark:border-gray-800 rounded-r-lg p-6 shadow-md space-y-4">
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            You do not have authorization to perform this action.
          </h2>
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded font-mono text-xs text-red-700 dark:text-red-300 break-all leading-relaxed">
            User: <span className="font-bold">{userArn}</span> is not authorized to perform:{' '}
            <span className="font-bold underline">{requiredPermission}</span> on resource:{' '}
            <span className="font-bold">arn:aws:iam::{accountId}:*</span> because no identity-based policy allows the action.
          </div>
        </div>

        {/* Evaluation Logic Breakdown */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-aws-blue dark:text-cyan-400" />
            How AWS IAM evaluated your request:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40">
              <span className="font-bold text-gray-900 dark:text-white block mb-1">
                1. Explicit Deny Check
              </span>
              <p className="text-[11px] text-gray-500">
                Any matching statement with <code className="font-bold text-red-600">"Effect": "Deny"</code> immediately trumps all allows.
              </p>
            </div>
            <div className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40">
              <span className="font-bold text-gray-900 dark:text-white block mb-1">
                2. Explicit Allow Check
              </span>
              <p className="text-[11px] text-gray-500">
                At least one attached policy must contain <code className="font-bold text-emerald-600">"Effect": "Allow"</code> matching the action.
              </p>
            </div>
            <div className="p-3 rounded border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/10">
              <span className="font-bold text-red-700 dark:text-red-300 block mb-1">
                3. Default Deny (Implicit)
              </span>
              <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
                Your attached policies yielded no explicit allow, so access is denied by default.
              </p>
            </div>
          </div>
        </div>

        {/* Current user's assigned roles */}
        <div className="pt-2">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
            Your current assigned roles:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {user?.roles && user.roles.length > 0 ? (
              user.roles.map((roleName, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200"
                >
                  {roleName}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400 italic">No roles currently attached</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </button>

          <Link
            to="/dashboard"
            className="px-4 py-2 bg-aws-orange hover:bg-aws-orangeHover text-black rounded text-xs font-extrabold shadow-sm transition-colors"
          >
            AWS Console Dashboard
          </Link>

          <Link
            to="/policies"
            className="text-aws-blue dark:text-cyan-400 hover:underline text-xs font-semibold inline-flex items-center gap-1 ml-auto"
          >
            View Available Policies
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
