'use client';

import React, { useState } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import { OrganisationHierarchy } from '@/types/multiLevelRbac';
import {
  AlertTriangle,
  Building,
  CheckCircle,
  ChevronRight,
  FolderTree,
  MapPin,
  MoreVertical,
  Plus,
  Power,
  Server,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import SensitiveActionModal from '../common/SensitiveActionModal';

export default function OrganizationsModule() {
  const { session, organisations, activeOrg, hasPermission, addAuditLog } = useMultiLevelAdmin();

  const [selectedOrg, setSelectedOrg] = useState<OrganisationHierarchy>(activeOrg);
  const [selectedSite, setSelectedSite] = useState<OrganisationHierarchy['sites'][0] | null>(null);
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [createSiteModalOpen, setCreateSiteModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteCity, setNewSiteCity] = useState('');
  const [newSiteAe, setNewSiteAe] = useState('');

  const canCreateOrg = hasPermission('organisations', 'create', 'platform');
  const canSuspendOrg = hasPermission('organisations', 'delete', 'platform');
  const canManageSites = hasPermission('sites', 'create', 'organisation');

  const handleSuspendOrg = (reason: string) => {
    addAuditLog({
      action: 'organisations:suspend',
      resource: 'organisations',
      scope: 'platform',
      reason: `Suspended organisation ${selectedOrg.name} (${selectedOrg.code}). Reason: ${reason}`,
      diff: [{ field: 'status', before: 'active', after: 'suspended' }],
    });
  };

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200">
      {/* Module Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Organisations, Hospital Networks & Site Hierarchy
          </h1>
          <p className="text-gray-400 mt-1">
            Manage multi-tenant laboratory chains, regional branches, and PACS DICOM node configurations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageSites && (
            <button
              onClick={() => setCreateSiteModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-teal-400" />
              <span>Add Diagnostic Site</span>
            </button>
          )}

          {canCreateOrg && (
            <button
              onClick={() => setCreateOrgModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-black font-bold transition-all shadow-md"
            >
              <Plus className="w-3.5 h-3.5 text-black" />
              <span>Onboard New Organisation</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Hierarchy Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Organisations Tree */}
        <div className="lg:col-span-1 rounded-2xl border border-white/10 bg-[#0E273A]/60 backdrop-blur-md p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <FolderTree className="w-4 h-4 text-teal-400" />
              <span>Tenant Network Hierarchy</span>
            </div>
            <span className="text-[11px] font-mono text-gray-400">{organisations.length} Chains</span>
          </div>

          <div className="space-y-2">
            {organisations.map((org) => (
              <div
                key={org.id}
                onClick={() => {
                  setSelectedOrg(org);
                  setSelectedSite(org.sites[0] || null);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedOrg.id === org.id
                    ? 'bg-teal-500/15 border-teal-500/50 shadow-md text-white'
                    : 'bg-white/[0.02] border-white/10 hover:bg-white/5 text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-teal-400" />
                    <span className="font-bold text-sm text-white">{org.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 font-mono">
                  <span>Code: {org.code}</span>
                  <span>{org.sites.length} Active Sites</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Selected Organisation & Site Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Org Header Card */}
          <div className="rounded-2xl border border-white/10 bg-[#0E273A]/80 backdrop-blur-md p-5 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-white">{selectedOrg.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {selectedOrg.status.toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 text-gray-300 border border-white/10">
                    {selectedOrg.tier}
                  </span>
                </div>
                <p className="text-gray-400 text-xs">
                  Organisation Tenant ID: <span className="font-mono text-gray-300">{selectedOrg.id}</span> · Master Code:{' '}
                  <span className="font-mono text-teal-400">{selectedOrg.code}</span>
                </p>
              </div>

              {canSuspendOrg && (
                <button
                  onClick={() => setSuspendModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-300 font-semibold transition-colors"
                >
                  <Power className="w-3.5 h-3.5 text-red-400" />
                  <span>Suspend Tenant</span>
                </button>
              )}
            </div>

            {/* Sites Grid */}
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>Configured Sites & Radiology Nodes ({selectedOrg.sites.length})</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedOrg.sites.map((site) => (
                  <div
                    key={site.id}
                    onClick={() => setSelectedSite(site)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedSite?.id === site.id
                        ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-md'
                        : 'bg-white/[0.02] border-white/10 hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-white">{site.name}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          site.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'
                        }`}
                      />
                    </div>
                    <div className="text-[11px] text-gray-400 mb-2">
                      {site.city}, {site.state}
                    </div>

                    <div className="p-2 rounded-lg bg-black/40 font-mono text-[11px] flex items-center justify-between text-teal-300">
                      <span>PACS AE: {site.pacsAeTitle}</span>
                      <span className="text-gray-400">Port 11112</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-white/5">
                      <span>Studies Today: <strong className="text-white">{site.activeCasesToday}</strong></span>
                      <span className="text-red-400 font-bold">{site.statQueueDepth} STAT</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Suspend Confirmation Modal */}
      <SensitiveActionModal
        isOpen={suspendModalOpen}
        onClose={() => setSuspendModalOpen(false)}
        onConfirm={handleSuspendOrg}
        title={`Suspend Organisation: ${selectedOrg.name}`}
        actionLabel="Confirm Suspension"
        impactSummary={`Suspending this tenant will instantly pause all inbound DICOM transfers across ${selectedOrg.sites.length} hospital sites and lock out active clinicians until reactivated by Platform SRE.`}
        requiresConfirmationWord="SUSPEND_TENANT"
      />
    </div>
  );
}
