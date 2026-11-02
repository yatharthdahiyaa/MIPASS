import React, { useState, useEffect } from 'react';
import { iamApi } from '../../api/iam';
import { IamUser, IamRole, IamGroup } from '../../types/iam';
import { useAuth } from '../../context/AuthContext';
import { Can } from '../../components/common/Can';
import { Modal } from '../../components/common/Modal';
import { PasswordStrengthMeter } from '../../components/common/PasswordStrengthMeter';
import {
  Users,
  UserPlus,
  Search,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Trash2,
  RefreshCw,
  Lock,
  Unlock,
} from 'lucide-react';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<IamUser[]>([]);
  const [roles, setRoles] = useState<IamRole[]>([]);
  const [groups, setGroups] = useState<IamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Create User Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reset Password Modal State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<IamUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Delete User Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, rRes, gRes] = await Promise.all([
        iamApi.getUsers(),
        iamApi.getRoles(),
        iamApi.getGroups(),
      ]);

      if (uRes.success) setUsers(uRes.data);
      if (rRes.success) setRoles(rRes.data);
      if (gRes.success) setGroups(gRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load IAM users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await iamApi.createUser({
        username: createUsername.trim(),
        email: createEmail.trim(),
        password: createPassword,
        roleIds: selectedRoleIds,
        groupIds: selectedGroupIds,
      });

      if (res.success) {
        setIsCreateOpen(false);
        setCreateUsername('');
        setCreateEmail('');
        setCreatePassword('');
        setSelectedRoleIds([]);
        setSelectedGroupIds([]);
        fetchAllData();
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create IAM user.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleSuspend = async (u: IamUser) => {
    try {
      await iamApi.updateUser(u.id, { isSuspended: !u.isSuspended });
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setResetLoading(true);
    setResetError(null);

    try {
      await iamApi.resetUserPassword(targetUser.id, newPassword);
      setIsResetOpen(false);
      setNewPassword('');
      setTargetUser(null);
      alert(`Password successfully updated for user: ${targetUser.username}`);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!targetUser) return;
    setDeleteLoading(true);

    try {
      await iamApi.deleteUser(targetUser.id);
      setIsDeleteOpen(false);
      setTargetUser(null);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-aws-blue dark:text-cyan-400" />
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              IAM Users
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            An IAM user is an identity with specific credentials and permissions within your AWS account.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            title="Refresh user list"
            className="p-2 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Can action="users:create">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="py-2 px-3.5 bg-aws-orange hover:bg-aws-orangeHover text-black text-xs font-extrabold rounded shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Add user
            </button>
          </Can>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 dark:text-red-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3 bg-white dark:bg-aws-darkCard p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Filter users by username or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-xs text-gray-900 dark:text-white focus:outline-none"
        />
        <span className="text-[11px] text-gray-400 whitespace-nowrap">
          {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4 font-bold">User name</th>
                <th className="py-3 px-4 font-bold">Email</th>
                <th className="py-3 px-4 font-bold">Type / Status</th>
                <th className="py-3 px-4 font-bold">MFA</th>
                <th className="py-3 px-4 font-bold">Assigned Roles</th>
                <th className="py-3 px-4 font-bold">Groups</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-aws-orange border-t-transparent rounded-full animate-spin" />
                      <span>Loading IAM directory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 text-xs">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        {u.username}
                        {u.isRoot && (
                          <span className="text-[10px] bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-black border border-red-300 dark:border-red-800">
                            ROOT
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {u.id.slice(0, 8)}...</div>
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{u.email}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        {u.isSuspended ? (
                          <span className="text-[10px] bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 px-2 py-0.5 rounded font-bold">
                            Suspended
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded font-bold">
                            Active
                          </span>
                        )}
                        {u.isLocked && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> Locked (5 fails)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {u.isMfaEnabled ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> TOTP
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          None
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {u.roles?.length > 0 ? (
                          u.roles.map((r) => (
                            <span
                              key={r.id}
                              className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-cyan-300 border border-blue-200 dark:border-blue-900/50 text-[10px] font-semibold"
                            >
                              {r.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">No direct roles</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {u.groups?.length > 0 ? (
                          u.groups.map((g) => (
                            <span
                              key={g.id}
                              className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-semibold border border-gray-200 dark:border-gray-700"
                            >
                              {g.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Suspend / Resume toggle */}
                        {!u.isRoot && (
                          <Can action="users:update" fallback="disable">
                            <button
                              onClick={() => handleToggleSuspend(u)}
                              title={u.isSuspended ? 'Activate User' : 'Suspend User'}
                              className={`p-1.5 rounded cursor-pointer ${
                                u.isSuspended
                                  ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                  : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                              }`}
                            >
                              {u.isSuspended ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                          </Can>
                        )}

                        {/* Reset Password */}
                        <Can action="users:update" fallback="disable">
                          <button
                            onClick={() => {
                              setTargetUser(u);
                              setIsResetOpen(true);
                            }}
                            title="Reset Password"
                            className="p-1.5 text-aws-blue dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        </Can>

                        {/* Delete User (Cannot delete root or yourself) */}
                        {!u.isRoot && u.id !== currentUser?.id && (
                          <Can action="users:delete" fallback="disable">
                            <button
                              onClick={() => {
                                setTargetUser(u);
                                setIsDeleteOpen(true);
                              }}
                              title="Delete User"
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </Can>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New IAM User"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 dark:text-red-400 font-semibold">
              {createError}
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              User name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. bob.developer"
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Email address
            </label>
            <input
              type="email"
              required
              placeholder="bob@example.com"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-gray-700 dark:text-gray-300">
              Initial Password
            </label>
            <input
              type="password"
              required
              placeholder="Min 12 chars (Upper, lower, number, symbol)"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
            <PasswordStrengthMeter password={createPassword} />
          </div>

          {/* Role Assignment */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Attach IAM Roles
            </label>
            <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2 space-y-1.5 bg-gray-50/50 dark:bg-gray-800/30">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(r.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRoleIds([...selectedRoleIds, r.id]);
                      else setSelectedRoleIds(selectedRoleIds.filter((id) => id !== r.id));
                    }}
                    className="text-aws-orange focus:ring-aws-orange rounded"
                  />
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{r.name}</span>
                  <span className="text-[11px] text-gray-400">— {r.description || 'Custom role'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Group Assignment */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Assign to User Groups
            </label>
            <div className="max-h-28 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2 space-y-1.5 bg-gray-50/50 dark:bg-gray-800/30">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(g.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedGroupIds([...selectedGroupIds, g.id]);
                      else setSelectedGroupIds(selectedGroupIds.filter((id) => id !== g.id));
                    }}
                    className="text-aws-orange focus:ring-aws-orange rounded"
                  />
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{g.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-4 py-2 bg-aws-orange hover:bg-aws-orangeHover text-black rounded font-extrabold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {createLoading ? 'Provisioning...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title={`Reset Password for ${targetUser?.username}`}
        maxWidth="md"
      >
        <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
          {resetError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 font-semibold">
              {resetError}
            </div>
          )}

          <div className="space-y-1">
            <label className="block font-bold text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <input
              type="password"
              required
              autoFocus
              placeholder="Min 12 chars"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
            <PasswordStrengthMeter password={newPassword} />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsResetOpen(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetLoading}
              className="px-4 py-2 bg-aws-orange hover:bg-aws-orangeHover text-black rounded font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              {resetLoading ? 'Updating...' : 'Set New Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Confirm User Deletion"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to permanently delete IAM user{' '}
            <strong className="text-red-600 font-bold">{targetUser?.username}</strong>? This will revoke all session tokens and access permissions immediately.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteUser}
              disabled={deleteLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {deleteLoading ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
