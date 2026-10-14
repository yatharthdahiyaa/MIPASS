'use client';

import React, { useState } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import { PermissionScope } from '@/types/multiLevelRbac';
import DataTable, { Column } from '../common/DataTable';
import ScopeBadge from '../common/ScopeBadge';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Plus,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { BUILT_IN_ROLES } from '@/utils/multiLevelRbacDefaults';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  scope: PermissionScope;
  siteName: string;
  mfaEnabled: boolean;
  ssoGroup: string;
  lastLogin: string;
  status: 'active' | 'suspended' | 'invited';
}

export default function UsersModule() {
  const { session, activeOrg, activeSite, hasPermission, addAuditLog } = useMultiLevelAdmin();

  const [users, setUsers] = useState<UserRecord[]>([
    {
      id: 'usr_in_01',
      name: 'Dr. Sarah Lin',
      email: 's.lin@mipaas.ai',
      role: 'Clinical Governance Lead',
      scope: 'platform',
      siteName: 'Indraprastha Apollo (Sarita Vihar)',
      mfaEnabled: true,
      ssoGroup: 'MIPAAS-Platform-Admins',
      lastLogin: '12 mins ago',
      status: 'active',
    },
    {
      id: 'usr_in_02',
      name: 'Dr. Marcus Vance',
      email: 'm.vance@apollo.internal',
      role: 'Clinician / Radiologist',
      scope: 'site',
      siteName: 'Indraprastha Apollo (Sarita Vihar)',
      mfaEnabled: true,
      ssoGroup: 'Apollo-Radiology-Faculty',
      lastLogin: '24 mins ago',
      status: 'active',
    },
    {
      id: 'usr_in_03',
      name: 'Elena Rostova',
      email: 'e.rostova@apollo.internal',
      role: 'Compliance Officer (DPO)',
      scope: 'organisation',
      siteName: 'Apollo Network HQ',
      mfaEnabled: true,
      ssoGroup: 'Apollo-Security-DPO',
      lastLogin: '1 hour ago',
      status: 'active',
    },
    {
      id: 'usr_in_04',
      name: 'Pooja Iyer',
      email: 'p.iyer@apollo.internal',
      role: 'Technician / Uploader',
      scope: 'site',
      siteName: 'Apollo Hospitals (Navi Mumbai)',
      mfaEnabled: true,
      ssoGroup: 'Apollo-CT-Technicians',
      lastLogin: '3 hours ago',
      status: 'active',
    },
    {
      id: 'usr_in_05',
      name: 'Dr. David Chen',
      email: 'd.chen@hospital.internal',
      role: 'Referrer / Viewing Physician',
      scope: 'own',
      siteName: 'Apollo Health City (Hyderabad)',
      mfaEnabled: false,
      ssoGroup: 'External-OPD-Referrers',
      lastLogin: 'Yesterday',
      status: 'active',
    },
    {
      id: 'usr_in_06',
      name: 'Rajesh Kulkarni',
      email: 'r.kulkarni@apollo.internal',
      role: 'Site Administrator',
      scope: 'site',
      siteName: 'Apollo Central Lab (Bengaluru)',
      mfaEnabled: true,
      ssoGroup: 'Apollo-Site-Managers',
      lastLogin: '4 days ago',
      status: 'suspended',
    },
  ]);

  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState(BUILT_IN_ROLES[11].name); // Clinician
  const [newUserScope, setNewUserScope] = useState<PermissionScope>('site');

  const canCreateUser = hasPermission('users', 'create', 'organisation');

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: UserRecord = {
      id: `usr_${Date.now()}`,
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      scope: newUserScope,
      siteName: activeSite.name,
      mfaEnabled: true,
      ssoGroup: 'SCIM-Default-Staff',
      lastLogin: 'Invited (Pending verification)',
      status: 'invited',
    };

    setUsers([newUser, ...users]);
    setInviteModalOpen(false);
    setNewUserName('');
    setNewUserEmail('');

    addAuditLog({
      action: 'users:invite',
      resource: 'users',
      scope: newUserScope,
      reason: `Invited user ${newUser.email} with role ${newUser.role} at scope ${newUser.scope}`,
    });
  };

  const handleToggleSuspend = (user: UserRecord) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    setUsers(users.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
    if (selectedUser?.id === user.id) {
      setSelectedUser({ ...selectedUser, status: nextStatus });
    }

    addAuditLog({
      action: nextStatus === 'suspended' ? 'users:deactivate' : 'users:activate',
      resource: 'users',
      scope: user.scope,
      reason: `Admin altered status for user ${user.email} to ${nextStatus}`,
    });
  };

  const columns: Column<UserRecord>[] = [
    {
      key: 'name',
      header: 'Staff Member',
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-xs">
            {u.name.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-white">{u.name}</div>
            <div className="text-[11px] text-gray-400">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role & Scope',
      render: (u) => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-200">{u.role}</span>
          <ScopeBadge scope={u.scope} />
        </div>
      ),
    },
    {
      key: 'siteName',
      header: 'Hospital Branch / Site',
      render: (u) => <span className="text-gray-300 font-mono text-[11px]">{u.siteName}</span>,
    },
    {
      key: 'mfaEnabled',
      header: 'Security (MFA & SSO)',
      render: (u) => (
        <div className="flex items-center gap-1.5">
          {u.mfaEnabled ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>MFA Enforced</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>MFA Pending</span>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last Session Activity',
      render: (u) => <span className="text-gray-400 text-[11px] font-mono">{u.lastLogin}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            u.status === 'active'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : u.status === 'suspended'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}
        >
          {u.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200 relative">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Users, Personnel & Identity Access Management (IAM)
          </h1>
          <p className="text-gray-400 mt-1">
            Assign fine-grained diagnostic permissions across Indian healthcare branches with SSO & SCIM group mapping.
          </p>
        </div>

        {canCreateUser && (
          <button
            onClick={() => setInviteModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-black font-bold transition-all shadow-md"
          >
            <UserPlus className="w-3.5 h-3.5 text-black" />
            <span>Invite Staff Member</span>
          </button>
        )}
      </div>

      {/* Main DataTable */}
      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder="Filter staff by name, email, or role..."
        searchKey={(u) => `${u.name} ${u.email} ${u.role}`}
        onRowClick={(row) => setSelectedUser(row)}
        exportFileName="mipaas-users-directory.csv"
      />

      {/* Side Drawer: User Details & Session Management */}
      {selectedUser && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 z-50 bg-[#07131D] border-l border-white/15 p-6 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200 text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-sm">
                {selectedUser.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{selectedUser.name}</h3>
                <p className="text-gray-400 text-[11px]">{selectedUser.email}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Identity & Status */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">User ID:</span>
                <span className="font-mono text-gray-200">{selectedUser.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Account Status:</span>
                <span className="font-bold text-teal-400 uppercase">{selectedUser.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">SSO / SCIM Mapping:</span>
                <span className="font-mono text-gray-300">{selectedUser.ssoGroup}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Branch Assignment:</span>
                <span className="text-white font-medium">{selectedUser.siteName}</span>
              </div>
            </div>

            {/* Role & Scope Details */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="font-semibold text-white text-xs mb-1">Assigned Role Bundle:</div>
              <div className="flex items-center justify-between">
                <span className="text-teal-300 font-bold">{selectedUser.role}</span>
                <ScopeBadge scope={selectedUser.scope} />
              </div>
              <p className="text-gray-400 text-[11px]">
                Permissions apply at <strong>{selectedUser.scope}</strong> scope within {activeOrg.name}.
              </p>
            </div>

            {/* Session Management */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="font-semibold text-white text-xs mb-1">Active Device Sessions:</div>
              <div className="p-2 rounded-lg bg-black/40 font-mono text-[11px] space-y-1">
                <div className="flex justify-between text-gray-300">
                  <span>Chrome 130 · Windows 11</span>
                  <span className="text-emerald-400">Current</span>
                </div>
                <div className="text-gray-500 text-[10px]">IP: 103.21.244.18 (New Delhi, India)</div>
              </div>

              <button
                onClick={() => {
                  alert(`Terminated all active tokens for ${selectedUser.email}`);
                  addAuditLog({
                    action: 'sessions:revoke',
                    resource: 'users',
                    scope: selectedUser.scope,
                    reason: `Admin terminated all active refresh tokens for user ${selectedUser.email}`,
                  });
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Revoke Active Sessions</span>
              </button>
            </div>

            {/* Deactivate User Button */}
            <div className="pt-2">
              <button
                onClick={() => handleToggleSuspend(selectedUser)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-colors ${
                  selectedUser.status === 'active'
                    ? 'bg-red-950/60 hover:bg-red-900/70 border border-red-500/40 text-red-300'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300'
                }`}
              >
                {selectedUser.status === 'active' ? (
                  <>
                    <UserX className="w-4 h-4" />
                    <span>Deactivate Staff Account</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Reactivate Staff Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-3xl border border-white/20 p-6 shadow-2xl text-white"
            style={{ backgroundColor: '#0A1823' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 font-bold text-base">
                <UserPlus className="w-5 h-5 text-teal-400" />
                <span>Invite Clinical / Lab Personnel</span>
              </div>
              <button onClick={() => setInviteModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">Full Legal Name *</label>
                <input
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Dr. Ananya Mukherjee"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Official Email Address *</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="a.mukherjee@apollo.internal"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Assigned Role *</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0E273A] border border-white/10 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {BUILT_IN_ROLES.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.levelLabel.split('·')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Permission Scope *</label>
                <select
                  value={newUserScope}
                  onChange={(e) => setNewUserScope(e.target.value as PermissionScope)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0E273A] border border-white/10 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="site">Site Scope (Selected Branch Only)</option>
                  <option value="organisation">Organisation Scope (All Sites in Chain)</option>
                  <option value="own">Own Scope (Assigned Cases Only)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-black font-bold"
                >
                  Send SCIM Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
