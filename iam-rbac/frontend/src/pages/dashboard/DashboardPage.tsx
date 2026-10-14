import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { iamApi } from '../../api/iam';
import {
  Users,
  Key,
  FolderLock,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Terminal,
  CheckCircle,
  XCircle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export function DashboardPage() {
  const { user, can } = useAuth();

  const [stats, setStats] = useState({
    usersCount: 0,
    rolesCount: 0,
    groupsCount: 0,
    policiesCount: 0,
    loading: true,
  });

  // Policy Simulator Interactive State
  const [testAction, setTestAction] = useState('users:create');
  const [testResource, setTestResource] = useState('*');
  const [simResult, setSimResult] = useState<{
    tested: boolean;
    allowed: boolean;
    reason: string;
  }>({
    tested: false,
    allowed: false,
    reason: '',
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const [usersRes, rolesRes, groupsRes, policiesRes] = await Promise.allSettled([
          iamApi.getUsers(),
          iamApi.getRoles(),
          iamApi.getGroups(),
          iamApi.getPolicies(),
        ]);

        setStats({
          usersCount: usersRes.status === 'fulfilled' && usersRes.value.success ? usersRes.value.data.length : 0,
          rolesCount: rolesRes.status === 'fulfilled' && rolesRes.value.success ? rolesRes.value.data.length : 0,
          groupsCount: groupsRes.status === 'fulfilled' && groupsRes.value.success ? groupsRes.value.data.length : 0,
          policiesCount: policiesRes.status === 'fulfilled' && policiesRes.value.success ? policiesRes.value.data.length : 0,
          loading: false,
        });
      } catch {
        setStats((prev) => ({ ...prev, loading: false }));
      }
    }

    loadStats();
  }, []);

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testAction.trim()) return;

    if (user?.isRoot) {
      setSimResult({
        tested: true,
        allowed: true,
        reason: 'Root user possesses superuser bypass (implicit * on all actions and resources).',
      });
      return;
    }

    const isAllowed = can(testAction.trim(), testResource.trim());

    if (isAllowed) {
      setSimResult({
        tested: true,
        allowed: true,
        reason: `Action '${testAction}' is explicitly ALLOWED by matching policy statements in your assigned role(s).`,
      });
    } else {
      setSimResult({
        tested: true,
        allowed: false,
        reason: `Action '${testAction}' is DENIED (either explicit Deny or implicit Default Deny).`,
      });
    }
  };

  const getMipaasUrl = (path: string) => {
    if (!user) return `http://localhost:3000${path}`;
    try {
      const ssoPayload = btoa(encodeURIComponent(JSON.stringify(user)));
      return `http://localhost:3000${path}?sso_user=${ssoPayload}`;
    } catch {
      return `http://localhost:3000${path}`;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              IAM Dashboard
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              Global Identity Hub
            </span>
          </div>
          <p className="text-xs text-gray-500">
            AWS Identity and Access Management (IAM) manages secure access to compute, storage, and billing resources.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/users"
            className="py-2 px-3.5 bg-aws-orange hover:bg-aws-orangeHover text-black text-xs font-extrabold rounded shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            Manage Users
          </Link>
          <Link
            to="/audit-logs"
            className="py-2 px-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded flex items-center gap-1.5 transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            Sign-in Logs
          </Link>
        </div>
      </div>

      {/* Security Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Account Identity */}
        <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 rounded-lg p-5 shadow-sm space-y-3">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            AWS Account Details
          </span>
          <div>
            <div className="text-sm font-extrabold text-gray-900 dark:text-white">
              {user?.accountName || 'My AWS Organization'}
            </div>
            <div className="text-xs font-mono text-gray-500 mt-0.5">
              Account ID: <span className="text-aws-blue dark:text-cyan-400 font-bold">{user?.accountId}</span>
            </div>
            {user?.accountAlias && (
              <div className="text-xs text-gray-500">
                Alias: <span className="font-semibold text-gray-700 dark:text-gray-300">{user.accountAlias}</span>
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-xs">
            <span className="text-gray-500">Signed in as:</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {user?.isRoot ? 'Root User' : `IAM: ${user?.username}`}
            </span>
          </div>
        </div>

        {/* Security Posture / MFA */}
        <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 rounded-lg p-5 shadow-sm space-y-3">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Security Recommendations
          </span>
          <div className="flex items-start gap-3">
            {user?.isMfaEnabled ? (
              <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded">
                <ShieldCheck className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded">
                <ShieldAlert className="w-5 h-5" />
              </div>
            )}
            <div className="space-y-1">
              <div className="text-xs font-bold text-gray-900 dark:text-white">
                Multi-Factor Authentication (MFA)
              </div>
              <p className="text-[11px] text-gray-500">
                {user?.isMfaEnabled
                  ? 'MFA is active and safeguarding your credentials.'
                  : 'MFA is not enabled. Activate TOTP to secure your account.'}
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800/80 flex justify-between items-center text-xs">
            <span className="text-gray-500">Password status:</span>
            <span className="text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Compliant (Argon2id/Bcrypt)
            </span>
          </div>
        </div>

        {/* Access Evaluation Status */}
        <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 rounded-lg p-5 shadow-sm space-y-3">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Authorization Engine
          </span>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-gray-500">Evaluation Strategy:</span>
              <span className="font-bold text-gray-900 dark:text-white">Explicit Deny &gt; Allow</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-gray-500">Default Behavior:</span>
              <span className="font-bold text-red-600 dark:text-red-400">Default Deny</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Active Roles:</span>
              <span className="font-bold text-aws-blue dark:text-cyan-400">
                {user?.roles?.join(', ') || 'Root'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MiPAAS Clinical Platform Integration Banner */}
      <div className="bg-gradient-to-r from-[#07131D] via-[#0B1E2E] to-[#0A1823] border border-[#00DCCE]/30 rounded-xl p-5 shadow-lg text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-[#00DCCE]/20 border border-[#00DCCE]/40 text-[#00DCCE] text-[10px] font-mono font-bold uppercase tracking-wider">
                Single Sign-On &amp; RBAC Active
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                Instance: http://localhost:3000
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>MiPAAS Clinical Healthcare Platform</span>
            </h2>
            <p className="text-xs text-gray-300 mt-0.5">
              Role permissions assigned here automatically govern diagnostic imaging, DICOM PACS routing, and explainable AI insights.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={getMipaasUrl('/doctor')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg bg-[#00DCCE] hover:bg-[#00DCCE]/90 text-black text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Activity className="w-4 h-4 text-black" />
              <span>Doctor Workstation</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>

            <a
              href={getMipaasUrl('/admin')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Lab Admin Hub</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>

            <a
              href={getMipaasUrl('/#products')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>AI Pathways</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>
          </div>
        </div>

        {/* Clinical Mapping Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-black/40 border border-white/5">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
              Active IAM Identity
            </div>
            <div className="font-bold text-white">
              {user?.username} {user?.isRoot && '(Root)'}
            </div>
            <div className="text-[11px] text-teal-400 font-mono mt-0.5">
              Roles: {user?.roles?.join(', ') || 'Root Superuser'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-white/5">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
              Clinical Persona Mapping
            </div>
            <div className="font-bold text-[#00DCCE]">
              {user?.isRoot
                ? 'Platform Administrator'
                : user?.roles?.includes('Radiologist')
                ? 'Consultant Radiologist'
                : user?.roles?.includes('Technician')
                ? 'Imaging Technician'
                : user?.roles?.includes('Researcher')
                ? 'Clinical Researcher'
                : user?.roles?.includes('ComplianceOfficer')
                ? 'Data Protection Officer (DPO)'
                : 'Clinical Lead / Governance'}
            </div>
            <div className="text-[11px] text-gray-300 mt-0.5">
              {user?.isRoot
                ? 'Unrestricted access across PACS, AI models & billing.'
                : user?.roles?.includes('Radiologist')
                ? 'Sybil CT/MRI inference, heatmaps & report sign-off.'
                : user?.roles?.includes('Technician')
                ? 'DICOM C-STORE upload, PACS routing & scanner QA.'
                : 'DPDP consent inspection & statutory retention.'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-white/5">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
              PACS &amp; Compliance Standards
            </div>
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>DICOM PS3.4 &amp; DPDP 2023</span>
            </div>
            <div className="text-[11px] text-gray-300 mt-0.5">
              AE Title: MIPAAS_PACS_IN : 11112 (Listening)
            </div>
          </div>
        </div>
      </div>

      {/* IAM Resource Summary Cards */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
          IAM Resources in this account
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/users"
            className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 hover:border-aws-orange dark:hover:border-aws-orange rounded-lg p-5 shadow-sm transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <Users className="w-5 h-5 text-aws-blue dark:text-cyan-400" />
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {stats.loading ? '—' : stats.usersCount}
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Users
            </span>
          </Link>

          <Link
            to="/groups"
            className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 hover:border-aws-orange dark:hover:border-aws-orange rounded-lg p-5 shadow-sm transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <FolderLock className="w-5 h-5 text-indigo-500" />
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {stats.loading ? '—' : stats.groupsCount}
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              User Groups
            </span>
          </Link>

          <Link
            to="/roles"
            className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 hover:border-aws-orange dark:hover:border-aws-orange rounded-lg p-5 shadow-sm transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <Key className="w-5 h-5 text-amber-500" />
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {stats.loading ? '—' : stats.rolesCount}
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Roles
            </span>
          </Link>

          <Link
            to="/policies"
            className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 hover:border-aws-orange dark:hover:border-aws-orange rounded-lg p-5 shadow-sm transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <FileCode className="w-5 h-5 text-emerald-500" />
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {stats.loading ? '—' : stats.policiesCount}
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Policies
            </span>
          </Link>
        </div>
      </div>

      {/* Live IAM Policy Simulator Widget */}
      <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-aws-orange" />
            <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
              IAM Policy Simulator (Live Session Tester)
            </h2>
          </div>
          <span className="text-[11px] text-gray-500">
            Simulate authorization against your current identity's resolved policies
          </span>
        </div>

        <form onSubmit={handleSimulate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
              Action to Test (e.g. users:create, billing:read)
            </label>
            <input
              type="text"
              required
              value={testAction}
              onChange={(e) => setTestAction(e.target.value)}
              placeholder="users:create"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
              Resource ARN / Wildcard
            </label>
            <input
              type="text"
              required
              value={testResource}
              onChange={(e) => setTestResource(e.target.value)}
              placeholder="*"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 px-4 bg-aws-navy hover:bg-gray-800 text-white font-extrabold rounded text-xs transition-colors cursor-pointer border border-gray-700"
            >
              Simulate Evaluation
            </button>
          </div>
        </form>

        {simResult.tested && (
          <div
            className={`p-4 rounded border text-xs flex items-start gap-3 animate-in fade-in duration-150 ${
              simResult.allowed
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-900 dark:text-red-200'
            }`}
          >
            {simResult.allowed ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            )}
            <div>
              <div className="font-black text-sm uppercase tracking-wide">
                Decision: {simResult.allowed ? 'Implicit / Explicit ALLOW' : 'DENIED'}
              </div>
              <p className="mt-1 leading-relaxed">{simResult.reason}</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Links Footer Card */}
      <div className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-400">
        <div>
          <span className="font-bold text-gray-900 dark:text-white">AWS Best Practice: </span>
          Lock away your AWS account root user access keys and use IAM users with least-privilege roles for everyday tasks.
        </div>
        <Link
          to="/audit-logs"
          className="text-aws-blue dark:text-cyan-400 hover:underline font-semibold flex items-center gap-1"
        >
          View AWS CloudTrail / Audit Logs
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
