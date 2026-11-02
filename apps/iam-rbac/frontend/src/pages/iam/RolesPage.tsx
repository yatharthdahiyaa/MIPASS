import React, { useState, useEffect } from 'react';
import { iamApi } from '../../api/iam';
import { IamRole, IamPolicy } from '../../types/iam';
import { Can } from '../../components/common/Can';
import { Modal } from '../../components/common/Modal';
import {
  Key,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  FileCode,
  Users,
} from 'lucide-react';

export function RolesPage() {
  const [roles, setRoles] = useState<IamRole[]>([]);
  const [policies, setPolicies] = useState<IamPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Create Role State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Manage Policies State
  const [isManagePoliciesOpen, setIsManagePoliciesOpen] = useState(false);
  const [targetRole, setTargetRole] = useState<IamRole | null>(null);
  const [editPolicyIds, setEditPolicyIds] = useState<string[]>([]);
  const [manageLoading, setManageLoading] = useState(false);

  // Delete Role State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, pRes] = await Promise.all([iamApi.getRoles(), iamApi.getPolicies()]);
      if (rRes.success) setRoles(rRes.data);
      if (pRes.success) setPolicies(pRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await iamApi.createRole({
        name: roleName.trim(),
        description: roleDesc.trim(),
        policyIds: selectedPolicyIds,
      });

      if (res.success) {
        setIsCreateOpen(false);
        setRoleName('');
        setRoleDesc('');
        setSelectedPolicyIds([]);
        fetchAllData();
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create role.');
    } finally {
      setCreateLoading(false);
    }
  };

  const openManagePolicies = (r: IamRole) => {
    setTargetRole(r);
    setEditPolicyIds(r.policies ? r.policies.map((p) => p.id) : []);
    setIsManagePoliciesOpen(true);
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRole) return;
    setManageLoading(true);

    try {
      await iamApi.updateRole(targetRole.id, {
        policyIds: editPolicyIds,
      });
      setIsManagePoliciesOpen(false);
      setTargetRole(null);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to update attached policies.');
    } finally {
      setManageLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!targetRole) return;
    setDeleteLoading(true);

    try {
      await iamApi.deleteRole(targetRole.id);
      setIsDeleteOpen(false);
      setTargetRole(null);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete role.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Key className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              IAM Roles
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            An IAM role defines a set of permissions policies that grant or deny access to AWS actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            title="Refresh roles list"
            className="p-2 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Can action="roles:create">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="py-2 px-3.5 bg-aws-orange hover:bg-aws-orangeHover text-black text-xs font-extrabold rounded shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create role
            </button>
          </Can>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 dark:text-red-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 bg-white dark:bg-aws-darkCard p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Filter roles by name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-xs text-gray-900 dark:text-white focus:outline-none"
        />
        <span className="text-[11px] text-gray-400 whitespace-nowrap">
          {filteredRoles.length} role{filteredRoles.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Roles Grid / Table */}
      <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4 font-bold">Role name</th>
                <th className="py-3 px-4 font-bold">Description</th>
                <th className="py-3 px-4 font-bold">Type</th>
                <th className="py-3 px-4 font-bold">Attached Policies</th>
                <th className="py-3 px-4 font-bold">Entities</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-aws-orange border-t-transparent rounded-full animate-spin" />
                      <span>Loading roles...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 text-xs">
                    No roles found.
                  </td>
                </tr>
              ) : (
                filteredRoles.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-500" />
                        {r.name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {r.id.slice(0, 8)}...</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {r.description || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {r.isSystem ? (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-black border border-purple-300 dark:border-purple-800 inline-flex items-center gap-1">
                          <Shield className="w-3 h-3" /> AWS Built-in
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded font-bold">
                          Custom Role
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[280px]">
                        {r.policies && r.policies.length > 0 ? (
                          r.policies.map((p) => (
                            <span
                              key={p.id}
                              className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold"
                            >
                              {p.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">No policies attached</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span>{r.userCount} users</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Attach/Detach Policies */}
                        <Can action="roles:update" fallback="disable">
                          <button
                            onClick={() => openManagePolicies(r)}
                            title="Manage Attached Policies"
                            className="p-1.5 text-aws-blue dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded cursor-pointer"
                          >
                            <FileCode className="w-4 h-4" />
                          </button>
                        </Can>

                        {/* Delete Role (Protected if system role) */}
                        {!r.isSystem && (
                          <Can action="roles:delete" fallback="disable">
                            <button
                              onClick={() => {
                                setTargetRole(r);
                                setIsDeleteOpen(true);
                              }}
                              title="Delete Role"
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

      {/* CREATE ROLE MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New IAM Role"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 font-semibold">
              {createError}
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Role name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. S3DataEngineer"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Permissions granted by this role..."
              value={roleDesc}
              onChange={(e) => setRoleDesc(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Attach Permissions Policies
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2 space-y-1.5 bg-gray-50/50 dark:bg-gray-800/30">
              {policies.map((p) => (
                <label key={p.id} className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedPolicyIds.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedPolicyIds([...selectedPolicyIds, p.id]);
                      else setSelectedPolicyIds(selectedPolicyIds.filter((id) => id !== p.id));
                    }}
                    className="mt-0.5 text-aws-orange focus:ring-aws-orange rounded"
                  />
                  <div>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{p.name}</span>
                    <p className="text-[11px] text-gray-500">{p.description || 'Custom policy'}</p>
                  </div>
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
              disabled={createLoading || !roleName.trim()}
              className="px-4 py-2 bg-aws-orange hover:bg-aws-orangeHover text-black rounded font-extrabold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {createLoading ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MANAGE POLICIES MODAL */}
      <Modal
        isOpen={isManagePoliciesOpen}
        onClose={() => setIsManagePoliciesOpen(false)}
        title={`Attach / Detach Policies for Role: ${targetRole?.name}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSavePolicies} className="space-y-4 text-xs">
          <p className="text-gray-600 dark:text-gray-400">
            Select the JSON permissions policies that should be attached to this role.
          </p>

          <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2 space-y-2 bg-gray-50/50 dark:bg-gray-800/30">
            {policies.map((p) => (
              <label key={p.id} className="flex items-start gap-2.5 p-1.5 hover:bg-white dark:hover:bg-gray-800 rounded cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editPolicyIds.includes(p.id)}
                  onChange={(e) => {
                    if (e.target.checked) setEditPolicyIds([...editPolicyIds, p.id]);
                    else setEditPolicyIds(editPolicyIds.filter((id) => id !== p.id));
                  }}
                  className="mt-0.5 text-aws-orange focus:ring-aws-orange rounded"
                />
                <div>
                  <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    {p.name}
                    {p.isSystem && (
                      <span className="text-[9px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-1 py-0.2 rounded font-bold">
                        AWS
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500">{p.description}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsManagePoliciesOpen(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={manageLoading}
              className="px-4 py-2 bg-aws-orange hover:bg-aws-orangeHover text-black rounded font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              {manageLoading ? 'Saving...' : 'Save Policy Attachments'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete IAM Role"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete role{' '}
            <strong className="text-red-600 font-bold">{targetRole?.name}</strong>? Any users or groups relying on this role will lose its permissions.
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
              onClick={handleDeleteRole}
              disabled={deleteLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {deleteLoading ? 'Deleting...' : 'Delete Role'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
