'use client';

import React, { useState } from 'react';
import { Action, Permission, PermissionScope, Resource, RoleDefinition } from '@/types/multiLevelRbac';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  Info,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import ScopeBadge from './ScopeBadge';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';

interface PermissionMatrixProps {
  role: RoleDefinition;
  onCloneRole?: (clonedRole: RoleDefinition) => void;
  onUpdateRole?: (updatedRole: RoleDefinition) => void;
}

const ALL_RESOURCES: { id: Resource; label: string; desc: string; category: string }[] = [
  { id: 'overview', label: 'Overview & KPIs', desc: 'Read diagnostic volumes and SLA metrics', category: 'Core' },
  { id: 'clinical_ops', label: 'Clinical Operations & Worklist', desc: 'Case worklists, triage queues, radiology reports', category: 'Core' },
  { id: 'organisations', label: 'Organisations & Tenant Tree', desc: 'Diagnostic chains, hospital network onboarding', category: 'Access' },
  { id: 'sites', label: 'Sites & Branches', desc: 'Local imaging centers, PACS AE titles', category: 'Access' },
  { id: 'users', label: 'Users & IAM Accounts', desc: 'Staff invitations, role grants, session revocation', category: 'Access' },
  { id: 'roles', label: 'Roles & Permission Matrix', desc: 'Custom role authoring, privilege scoping', category: 'Access' },
  { id: 'approvals', label: 'Approvals & Dual Sign-Off', desc: 'Two-person authorization workflows', category: 'Governance' },
  { id: 'breakglass', label: 'Break-Glass Emergency Access', desc: 'Temporary elevated root escalation', category: 'Governance' },
  { id: 'models', label: 'AI Diagnostic Models', desc: 'Model catalogue, enablement, validation state', category: 'AI Engine' },
  { id: 'agents', label: 'Autonomous AI Agents', desc: 'L0-L2 agent dispatch rules and autonomy tiers', category: 'AI Engine' },
  { id: 'thresholds', label: 'Diagnostic ROC Thresholds', desc: 'Sensitivity & specificity tuning', category: 'AI Engine' },
  { id: 'privacy_consent', label: 'Privacy & DPDP Act 2023', desc: 'Consent records, statutory erasure exemptions', category: 'Compliance' },
  { id: 'integrations', label: 'PACS / HL7 / API Keys', desc: 'DICOM C-ECHO, FHIR endpoints, secret keys', category: 'Infrastructure' },
  { id: 'billing', label: 'Billing & Invoicing (₹ INR)', desc: 'Tiered scan slabs, GST invoices, cost forecasts', category: 'Finance' },
  { id: 'audit', label: 'Forensic Audit Trails', desc: 'Immutable security and data access logs', category: 'Compliance' },
  { id: 'platform_health', label: 'Platform SRE Health', desc: 'GPU cluster load, model inference latency', category: 'Infrastructure' },
];

const ALL_ACTIONS: { id: Action; label: string }[] = [
  { id: 'read', label: 'Read' },
  { id: 'create', label: 'Create' },
  { id: 'update', label: 'Update' },
  { id: 'delete', label: 'Delete / Erase' },
  { id: 'review', label: 'Review' },
  { id: 'approve', label: 'Approve' },
  { id: 'export', label: 'Export' },
  { id: 'breakglass', label: 'Break-Glass' },
];

const SCOPES: PermissionScope[] = ['platform', 'organisation', 'site', 'own'];

// Check if a permission is high risk
function getRiskInfo(resource: Resource, action: Action): { isRisky: boolean; desc?: string } {
  if (action === 'delete' && (resource === 'privacy_consent' || resource === 'organisations')) {
    return { isRisky: true, desc: 'High Risk: Permanent erasure of clinical records or hospital tenant data.' };
  }
  if (action === 'create' && resource === 'integrations') {
    return { isRisky: true, desc: 'High Risk: Generates raw production API keys with network egress authority.' };
  }
  if (action === 'breakglass') {
    return { isRisky: true, desc: 'Extreme Risk: Bypasses multi-tenant data boundaries for incident triage.' };
  }
  if (action === 'approve' && resource === 'thresholds') {
    return { isRisky: true, desc: 'Clinical Risk: Modifies diagnostic false positive/negative ROC thresholds.' };
  }
  return { isRisky: false };
}

export default function PermissionMatrix({
  role,
  onCloneRole,
  onUpdateRole,
}: PermissionMatrixProps) {
  const { simulateRole } = useMultiLevelAdmin();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [currentPermissions, setCurrentPermissions] = useState<Permission[]>(role.permissions);

  // Helper to check if role has permission for a cell
  const getCellPermission = (res: Resource, act: Action): Permission | undefined => {
    return currentPermissions.find((p) => p.resource === res && p.action === act);
  };

  // Toggle permission cell
  const handleToggleCell = (res: Resource, act: Action) => {
    if (role.isBuiltIn) return; // Built-in roles are read-only

    const existing = getCellPermission(res, act);
    let next: Permission[];

    if (existing) {
      // Cycle scope or remove: own -> site -> organisation -> platform -> remove
      const currIdx = SCOPES.indexOf(existing.scope);
      if (currIdx < SCOPES.length - 1) {
        const nextScope = SCOPES[currIdx + 1];
        next = currentPermissions.map((p) =>
          p.resource === res && p.action === act ? { ...p, scope: nextScope } : p
        );
      } else {
        next = currentPermissions.filter((p) => !(p.resource === res && p.action === act));
      }
    } else {
      // Add initial permission at 'site' scope
      const risk = getRiskInfo(res, act);
      const newPerm: Permission = {
        resource: res,
        action: act,
        scope: 'site',
        isRisky: risk.isRisky,
        riskDescription: risk.desc,
      };
      next = [...currentPermissions, newPerm];
    }

    setCurrentPermissions(next);
    if (onUpdateRole) {
      onUpdateRole({ ...role, permissions: next });
    }
  };

  const categories = ['All', 'Core', 'Access', 'Governance', 'AI Engine', 'Compliance', 'Infrastructure', 'Finance'];

  const filteredResources = ALL_RESOURCES.filter(
    (r) => activeCategory === 'All' || r.category === activeCategory
  );

  return (
    <div className="w-full flex flex-col space-y-4 text-xs text-gray-200">
      {/* Role Header Banner */}
      <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/80 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-base text-white">{role.name}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30">
              {role.levelLabel}
            </span>
            {role.isBuiltIn ? (
              <span className="flex items-center gap-1 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Built-in Role (Read-Only)</span>
              </span>
            ) : (
              <span className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Custom Editable Role
              </span>
            )}
          </div>
          <p className="text-gray-400 text-xs max-w-2xl">{role.description}</p>
        </div>

        {/* Top Actions: Clone, Preview as this role */}
        <div className="flex items-center gap-2">
          {/* Preview as this role */}
          <button
            onClick={() => simulateRole(role.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 font-semibold transition-all hover:scale-[1.02]"
            title="Switch your current dashboard view to preview how this role experiences MIPaaS"
          >
            <Eye className="w-3.5 h-3.5 text-teal-400" />
            <span>Preview as this Role</span>
          </button>

          {/* Clone Role (if built-in) */}
          {role.isBuiltIn && onCloneRole && (
            <button
              onClick={() => {
                const cloned: RoleDefinition = {
                  ...role,
                  id: `role_custom_${Date.now()}`,
                  name: `Custom ${role.name} (Clone)`,
                  isBuiltIn: false,
                  userCount: 0,
                };
                onCloneRole(cloned);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-semibold transition-colors"
              title="Clone this template into a custom editable role"
            >
              <Copy className="w-3.5 h-3.5 text-gray-400" />
              <span>Clone Role</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-teal-500/20 text-teal-300 font-bold border border-teal-500/40'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Permission Matrix Grid */}
      <div className="rounded-2xl border border-white/10 bg-[#0A1823]/70 overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-gray-400">
                <th className="py-3 px-4 min-w-[220px]">Resource & Clinical Capability</th>
                {ALL_ACTIONS.map((a) => (
                  <th key={a.id} className="py-3 px-3 text-center min-w-[100px] uppercase text-[11px]">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredResources.map((res) => (
                <tr key={res.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Resource Column */}
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{res.label}</div>
                    <div className="text-[11px] text-gray-400">{res.desc}</div>
                  </td>

                  {/* Action Cells */}
                  {ALL_ACTIONS.map((act) => {
                    const perm = getCellPermission(res.id, act.id);
                    const risk = getRiskInfo(res.id, act.id);

                    return (
                      <td key={act.id} className="py-3 px-2 text-center align-middle">
                        {perm ? (
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={() => handleToggleCell(res.id, act.id)}
                              disabled={role.isBuiltIn}
                              className={`p-1.5 rounded-lg border transition-all ${
                                risk.isRisky
                                  ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30'
                                  : 'bg-teal-500/20 border-teal-500/40 text-teal-300 hover:bg-teal-500/30'
                              } ${role.isBuiltIn ? 'cursor-default opacity-90' : 'cursor-pointer'}`}
                              title={
                                risk.desc
                                  ? `${risk.desc} Scope: ${perm.scope}`
                                  : `Active at ${perm.scope} scope. Click to cycle scope or remove.`
                              }
                            >
                              <div className="flex items-center gap-1">
                                {risk.isRisky ? (
                                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-teal-400" />
                                )}
                                <span className="text-[10px] font-mono font-bold uppercase">
                                  {perm.scope.slice(0, 3)}
                                </span>
                              </div>
                            </button>
                            <span className="text-[9px] text-gray-400 font-mono">
                              {perm.scope}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleToggleCell(res.id, act.id)}
                            disabled={role.isBuiltIn}
                            className={`w-6 h-6 rounded-md border border-dashed border-white/10 hover:border-white/30 flex items-center justify-center transition-colors ${
                              role.isBuiltIn ? 'cursor-not-allowed opacity-30' : 'hover:bg-white/5 cursor-pointer'
                            }`}
                            title={
                              role.isBuiltIn
                                ? 'Permission not granted in this built-in role'
                                : 'Click to grant permission'
                            }
                          >
                            <span className="text-gray-600 text-xs">·</span>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Matrix Legend Footer */}
        <div className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[11px] text-gray-400 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-300">Scope Hierarchy:</span>
            <span className="flex items-center gap-1 text-teal-400 font-mono font-bold">
              PLA (Platform)
            </span>
            <span>&gt;</span>
            <span className="flex items-center gap-1 text-purple-400 font-mono font-bold">
              ORG (Organisation)
            </span>
            <span>&gt;</span>
            <span className="flex items-center gap-1 text-amber-400 font-mono font-bold">
              SIT (Site)
            </span>
            <span>&gt;</span>
            <span className="flex items-center gap-1 text-gray-300 font-mono font-bold">
              OWN (Self Only)
            </span>
          </div>

          <div className="flex items-center gap-2 text-red-300">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Red badge indicates sensitive action (audit logging enforced)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
