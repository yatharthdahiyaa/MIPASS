'use client';

import React, { useState } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import { RoleDefinition } from '@/types/multiLevelRbac';
import { BUILT_IN_ROLES } from '@/utils/multiLevelRbacDefaults';
import PermissionMatrix from '../common/PermissionMatrix';
import {
  Copy,
  Eye,
  KeyRound,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react';

export default function RolesModule() {
  const { simulateRole, addAuditLog } = useMultiLevelAdmin();
  const [allRoles, setAllRoles] = useState<RoleDefinition[]>(BUILT_IN_ROLES);
  const [selectedRole, setSelectedRole] = useState<RoleDefinition>(allRoles[0]);

  const handleCloneRole = (cloned: RoleDefinition) => {
    setAllRoles([...allRoles, cloned]);
    setSelectedRole(cloned);
    addAuditLog({
      action: 'roles:clone',
      resource: 'roles',
      scope: 'organisation',
      reason: `Cloned template role ${cloned.name} into custom role bundle`,
    });
  };

  const handleUpdateRole = (updated: RoleDefinition) => {
    setAllRoles(allRoles.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedRole(updated);
    addAuditLog({
      action: 'roles:update',
      resource: 'roles',
      scope: 'organisation',
      reason: `Updated permission matrix for role ${updated.name}`,
    });
  };

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Roles, Access Bundles & Permission Matrix Engine
          </h1>
          <p className="text-gray-400 mt-1">
            Configure resource:action:scope bundles. Built-in roles are immutable and cloneable for custom site policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => simulateRole(selectedRole.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 font-bold transition-all hover:scale-[1.02]"
          >
            <Eye className="w-4 h-4 text-teal-400" />
            <span>Preview Dashboard as {selectedRole.name}</span>
          </button>
        </div>
      </div>

      {/* Grid: Role List (Left) + Permission Matrix (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role List (1 Col) */}
        <div className="lg:col-span-1 rounded-2xl border border-white/10 bg-[#0E273A]/60 backdrop-blur-md p-3 space-y-3">
          <div className="px-2 py-1 text-xs font-bold text-white flex items-center justify-between border-b border-white/10 pb-2">
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-teal-400" />
              <span>Available Role Bundles</span>
            </span>
            <span className="text-gray-400 font-mono text-[11px]">{allRoles.length} Roles</span>
          </div>

          <div className="space-y-1.5 max-h-[700px] overflow-y-auto">
            {allRoles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedRole.id === role.id
                    ? 'bg-teal-500/20 border-teal-500/50 text-white shadow-md'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/5 text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white truncate">{role.name}</span>
                  {role.isBuiltIn ? (
                    <Lock className="w-3 h-3 text-amber-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </div>
                <div className="text-[10px] text-gray-400 truncate mb-1.5">{role.levelLabel}</div>
                <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                  <span>{role.permissions.length} perms</span>
                  <span className="text-teal-400 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{role.userCount} users</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Permission Matrix (3 Cols) */}
        <div className="lg:col-span-3">
          <PermissionMatrix
            key={selectedRole.id}
            role={selectedRole}
            onCloneRole={handleCloneRole}
            onUpdateRole={handleUpdateRole}
          />
        </div>
      </div>
    </div>
  );
}
