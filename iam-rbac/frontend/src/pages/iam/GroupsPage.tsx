import React, { useState, useEffect } from 'react';
import { iamApi } from '../../api/iam';
import { IamGroup, IamRole, IamUser } from '../../types/iam';
import { Can } from '../../components/common/Can';
import { Modal } from '../../components/common/Modal';
import {
  FolderLock,
  Plus,
  RefreshCw,
  Search,
  Users,
  Key,
  Trash2,
  UserPlus,
} from 'lucide-react';

export function GroupsPage() {
  const [groups, setGroups] = useState<IamGroup[]>([]);
  const [roles, setRoles] = useState<IamRole[]>([]);
  const [users, setUsers] = useState<IamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Create Group Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Manage Group Members Modal State
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [targetGroup, setTargetGroup] = useState<IamGroup | null>(null);
  const [editUserIds, setEditUserIds] = useState<string[]>([]);
  const [manageLoading, setManageLoading] = useState(false);

  // Delete Group Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gRes, rRes, uRes] = await Promise.all([
        iamApi.getGroups(),
        iamApi.getRoles(),
        iamApi.getUsers(),
      ]);

      if (gRes.success) setGroups(gRes.data);
      if (rRes.success) setRoles(rRes.data);
      if (uRes.success) setUsers(uRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load user groups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await iamApi.createGroup({
        name: groupName.trim(),
        description: groupDesc.trim(),
        roleIds: selectedRoleIds,
        userIds: selectedUserIds,
      });

      if (res.success) {
        setIsCreateOpen(false);
        setGroupName('');
        setGroupDesc('');
        setSelectedRoleIds([]);
        setSelectedUserIds([]);
        fetchAllData();
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create group.');
    } finally {
      setCreateLoading(false);
    }
  };

  const openManageMembers = (g: IamGroup) => {
    setTargetGroup(g);
    setEditUserIds(g.users ? g.users.map((u) => u.id) : []);
    setIsManageMembersOpen(true);
  };

  const handleSaveMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetGroup) return;
    setManageLoading(true);

    try {
      await iamApi.updateGroup(targetGroup.id, {
        userIds: editUserIds,
      });
      setIsManageMembersOpen(false);
      setTargetGroup(null);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to update group members.');
    } finally {
      setManageLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!targetGroup) return;
    setDeleteLoading(true);

    try {
      await iamApi.deleteGroup(targetGroup.id);
      setIsDeleteOpen(false);
      setTargetGroup(null);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete group.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.description && g.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <FolderLock className="w-6 h-6 text-indigo-500" />
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              IAM User Groups
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            An IAM user group is a collection of IAM users. Groups allow you to specify permissions for multiple users at once.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            title="Refresh groups"
            className="p-2 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Can action="groups:create">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="py-2 px-3.5 bg-aws-orange hover:bg-aws-orangeHover text-black text-xs font-extrabold rounded shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create group
            </button>
          </Can>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 font-semibold text-xs">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-3 bg-white dark:bg-aws-darkCard p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Filter groups by name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-xs text-gray-900 dark:text-white focus:outline-none"
        />
        <span className="text-[11px] text-gray-400 whitespace-nowrap">
          {filteredGroups.length} group{filteredGroups.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4 font-bold">Group name</th>
                <th className="py-3 px-4 font-bold">Description</th>
                <th className="py-3 px-4 font-bold">Attached Roles</th>
                <th className="py-3 px-4 font-bold">Members</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-aws-orange border-t-transparent rounded-full animate-spin" />
                      <span>Loading user groups...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500 text-xs">
                    No groups found.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <FolderLock className="w-3.5 h-3.5 text-indigo-500" />
                        {g.name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {g.id.slice(0, 8)}...</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {g.description || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[240px]">
                        {g.roles && g.roles.length > 0 ? (
                          g.roles.map((r) => (
                            <span
                              key={r.id}
                              className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold"
                            >
                              {r.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">No roles attached</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-medium">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span>{g.users ? g.users.length : 0} members</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Manage Members */}
                        <Can action="groups:update" fallback="disable">
                          <button
                            onClick={() => openManageMembers(g)}
                            title="Manage Group Members"
                            className="p-1.5 text-aws-blue dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded cursor-pointer"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        </Can>

                        {/* Delete Group */}
                        <Can action="groups:delete" fallback="disable">
                          <button
                            onClick={() => {
                              setTargetGroup(g);
                              setIsDeleteOpen(true);
                            }}
                            title="Delete Group"
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE GROUP MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New IAM User Group"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 font-semibold">
              {createError}
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Group name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. SRE-Team"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder="Site Reliability Engineering group..."
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
            />
          </div>

          {/* Attach Roles */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Attach Roles (Permissions Inherited by Members)
            </label>
            <div className="max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2 space-y-1.5 bg-gray-50/50 dark:bg-gray-800/30">
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
                  <span className="text-[11px] text-gray-400">— {r.description}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Add Initial Users */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Add Initial Members
            </label>
            <div className="max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2 space-y-1.5 bg-gray-50/50 dark:bg-gray-800/30">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUserIds([...selectedUserIds, u.id]);
                      else setSelectedUserIds(selectedUserIds.filter((id) => id !== u.id));
                    }}
                    className="text-aws-orange focus:ring-aws-orange rounded"
                  />
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{u.username}</span>
                  <span className="text-[11px] text-gray-400">({u.email})</span>
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
              disabled={createLoading || !groupName.trim()}
              className="px-4 py-2 bg-aws-orange hover:bg-aws-orangeHover text-black rounded font-extrabold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {createLoading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MANAGE MEMBERS MODAL */}
      <Modal
        isOpen={isManageMembersOpen}
        onClose={() => setIsManageMembersOpen(false)}
        title={`Manage Members for: ${targetGroup?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveMembers} className="space-y-4 text-xs">
          <p className="text-gray-600 dark:text-gray-400">
            Select users to add to this group. Members automatically inherit all group-attached IAM roles.
          </p>

          <div className="max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2 space-y-2 bg-gray-50/50 dark:bg-gray-800/30">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2.5 p-1 hover:bg-white dark:hover:bg-gray-800 rounded cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editUserIds.includes(u.id)}
                  onChange={(e) => {
                    if (e.target.checked) setEditUserIds([...editUserIds, u.id]);
                    else setEditUserIds(editUserIds.filter((id) => id !== u.id));
                  }}
                  className="text-aws-orange focus:ring-aws-orange rounded"
                />
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">{u.username}</span>
                  <span className="text-[11px] text-gray-400 ml-1.5">({u.email})</span>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsManageMembersOpen(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={manageLoading}
              className="px-4 py-2 bg-aws-orange hover:bg-aws-orangeHover text-black rounded font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              {manageLoading ? 'Saving...' : 'Update Group Membership'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE GROUP MODAL */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete User Group"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete user group{' '}
            <strong className="text-red-600 font-bold">{targetGroup?.name}</strong>? Member users will remain in the directory but lose the group's inherited roles.
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
              onClick={handleDeleteGroup}
              disabled={deleteLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {deleteLoading ? 'Deleting...' : 'Delete Group'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
