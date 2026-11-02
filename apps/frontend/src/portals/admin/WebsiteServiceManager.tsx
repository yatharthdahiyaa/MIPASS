'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useServices } from '@/context/ServicesContext';
import { useRBAC } from '@/context/RBACContext';
import { ServiceConfig, ServiceStatus, MaintenanceReason } from '@/types/services';
import {
  Eye,
  EyeOff,
  Power,
  PowerOff,
  Settings2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  SlidersHorizontal,
  History,
  LayoutGrid,
  Filter,
  Layers,
  HelpCircle,
  X,
  Save,
  Check,
  Shield,
  UserCheck,
} from 'lucide-react';

export default function WebsiteServiceManager() {
  const {
    services,
    serviceAuditLogs,
    homepageServices,
    activeServices,
    toggleHomepageListing,
    toggleServiceStatus,
    updateServiceConfig,
    bulkRestoreAll,
    bulkEmergencyMaintenance,
    bulkReset,
  } = useServices();

  const { currentUser, currentRole, switchRole, hasRole } = useRBAC();
  const isAdmin = hasRole('admin');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'closed' | 'listed' | 'unlisted'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'controls' | 'preview' | 'audit'>('controls');

  // Edit Modal state
  const [editingService, setEditingService] = useState<ServiceConfig | null>(null);
  const [editNotice, setEditNotice] = useState('');
  const [editEta, setEditEta] = useState('');
  const [editReason, setEditReason] = useState<MaintenanceReason>('scheduled_maintenance');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Filtered Services
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      // Search
      const matchesSearch =
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.modality.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.tagline.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Filter
      if (filterMode === 'active') return service.status === 'active';
      if (filterMode === 'closed') return service.status !== 'active';
      if (filterMode === 'listed') return service.isListedOnHomepage;
      if (filterMode === 'unlisted') return !service.isListedOnHomepage;

      return true;
    });
  }, [services, searchQuery, filterMode]);

  const closedCount = services.filter((s) => s.status !== 'active').length;
  const unlistedCount = services.filter((s) => !s.isListedOnHomepage).length;

  const openEditModal = (service: ServiceConfig) => {
    setEditingService(service);
    setEditNotice(service.maintenanceNotice || '');
    setEditEta(service.estimatedRestore || '');
    setEditReason(service.maintenanceReason || 'scheduled_maintenance');
    setSaveSuccess(false);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    updateServiceConfig(editingService.id, {
      maintenanceNotice: editNotice,
      estimatedRestore: editEta,
      maintenanceReason: editReason,
    });

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setEditingService(null);
    }, 700);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* RBAC Role Notice / Fast Switcher */}
      {!isAdmin && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-slate-900 font-bold text-sm">
                Current Role: {currentUser.roleTitle} ({currentRole})
              </h3>
              <p className="text-xs text-amber-900/80">
                You are currently viewing service settings with clinician/read permissions. Switch to Administrator to modify website visibility and toggle downtime.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => switchRole('admin')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs flex items-center gap-2 transition-transform hover:scale-105 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <UserCheck className="w-4 h-4" />
            <span>Switch to Admin Persona</span>
          </button>
        </div>
      )}

      {/* Top Header & Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total AI Services
            </span>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{services.length}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            <span>Across LDCT, MRI, CXR, CT &amp; Derm</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active / Operational
            </span>
            <Power className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700">{activeServices.length}</div>
          <div className="text-xs text-emerald-700 mt-1">
            Accepting DICOM &amp; Live Inferences
          </div>
        </div>

        {/* Metric 3 */}
        <div
          className={`rounded-2xl border p-5 shadow-xs relative overflow-hidden transition-all ${
            closedCount > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Temporarily Closed
            </span>
            <PowerOff className={`w-4 h-4 ${closedCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black ${closedCount > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
            {closedCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {closedCount > 0 ? 'Showing maintenance screen to users' : 'All services open and operational'}
          </div>
        </div>

        {/* Metric 4 */}
        <div
          className={`rounded-2xl border p-5 shadow-xs relative overflow-hidden transition-all ${
            unlistedCount > 0
              ? 'bg-indigo-50 border-indigo-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Unlisted from Homepage
            </span>
            <EyeOff className={`w-4 h-4 ${unlistedCount > 0 ? 'text-indigo-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black ${unlistedCount > 0 ? 'text-indigo-800' : 'text-slate-700'}`}>
            {unlistedCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {unlistedCount > 0 ? 'Hidden from homepage public visitors' : 'All services visible on homepage'}
          </div>
        </div>
      </div>

      {/* Sub-Tabs & Emergency Batch Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('controls')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'controls'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Service Controls &amp; Visibility</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('preview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'preview'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Live Homepage Preview</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-mono">
              {homepageServices.length} Visible
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'audit'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Change Audit Trail</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-mono">
              {serviceAuditLogs.length}
            </span>
          </button>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={bulkRestoreAll}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Sets all 9 services to Active and Listed on Homepage"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Restore All (Active &amp; Listed)</span>
          </button>

          <button
            type="button"
            onClick={() => bulkEmergencyMaintenance()}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Temporarily sets all services to maintenance"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>Emergency Maintenance Mode</span>
          </button>

          <button
            type="button"
            onClick={bulkReset}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Reset to initial factory defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SERVICE CONTROLS & VISIBILITY TABLE */}
      {activeSubTab === 'controls' && (
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services by title, modality (e.g. MRI, LDCT)..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 uppercase font-semibold mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>Filter:</span>
              </span>
              {[
                { key: 'all', label: 'All Services' },
                { key: 'active', label: 'Operational' },
                { key: 'closed', label: 'Closed / Maint.' },
                { key: 'listed', label: 'Homepage Visible' },
                { key: 'unlisted', label: 'Homepage Unlisted' },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setFilterMode(pill.key as 'all' | 'active' | 'closed' | 'listed' | 'unlisted')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterMode === pill.key
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 gap-4">
            {filteredServices.map((service) => {
              const isClosed = service.status !== 'active';
              const isUnlisted = !service.isListedOnHomepage;

              return (
                <div
                  key={service.id}
                  className={`rounded-2xl border transition-all p-5 shadow-xs ${
                    isClosed
                      ? 'bg-amber-50/40 border-amber-200'
                      : isUnlisted
                      ? 'bg-indigo-50/30 border-indigo-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Service Identity */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs text-white font-bold text-sm"
                        style={{ backgroundColor: `${service.accent}25`, border: `1px solid ${service.accent}60` }}
                      >
                        <span style={{ color: service.accent }}>{service.modality}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-slate-900 font-bold text-base tracking-tight truncate">
                            {service.name}
                          </h3>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${service.accent}15`,
                              color: service.accent,
                              border: `1px solid ${service.accent}30`,
                            }}
                          >
                            {service.badge}
                          </span>

                          {/* Status badges */}
                          {isClosed ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-ping" />
                              <span>Temporarily Closed</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                              <span>Operational</span>
                            </span>
                          )}

                          {isUnlisted ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                              <EyeOff className="w-3 h-3 text-indigo-600" />
                              <span>Unlisted from Home</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                              <Eye className="w-3 h-3 text-teal-600" />
                              <span>Showing on Home</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-1 mb-2">
                          {service.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                          <span>Route: <code className="text-slate-700 font-mono">{service.href}</code></span>
                          <span>•</span>
                          <span>Last updated: {service.lastUpdated}</span>
                          {service.estimatedRestore && (
                            <>
                              <span>•</span>
                              <span className="text-amber-800 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Reopen ETA: {service.estimatedRestore}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Interactive Toggles & Controls */}
                    <div className="flex flex-wrap items-center gap-4 lg:gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                      {/* TOGGLE 1: HOMEPAGE VISIBILITY */}
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Homepage Listing
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleHomepageListing(service.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            service.isListedOnHomepage
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                          }`}
                          title={service.isListedOnHomepage ? 'Click to unlist and hide from homepage' : 'Click to list and show on homepage'}
                        >
                          {service.isListedOnHomepage ? (
                            <>
                              <Eye className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Listed on Home</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-indigo-700" />
                              <span>Unlisted (Hidden)</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* TOGGLE 2: OPERATIONAL STATUS */}
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Service Status
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleServiceStatus(service.id)}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            service.status === 'active'
                              ? 'bg-teal-50 border-teal-300 text-teal-800 hover:bg-teal-100'
                              : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                          }`}
                          title={service.status === 'active' ? 'Click to temporarily close this service' : 'Click to re-open service'}
                        >
                          {service.status === 'active' ? (
                            <>
                              <Power className="w-3.5 h-3.5 text-teal-600" />
                              <span>Active / Open</span>
                            </>
                          ) : (
                            <>
                              <PowerOff className="w-3.5 h-3.5 text-amber-600" />
                              <span>Closed (Maint.)</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* ACTION BUTTONS */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Notice & Config button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(service)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-xs"
                          title="Configure maintenance notice & reopening ETA"
                        >
                          <Settings2 className="w-4 h-4 text-teal-600" />
                        </button>

                        {/* View Service button */}
                        <Link
                          href={service.href}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-xs"
                          title="Open live service route in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* If in maintenance, show current notice strip */}
                  {isClosed && (
                    <div className="mt-4 pt-3 border-t border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 bg-amber-50 -mx-5 -mb-5 p-4 rounded-b-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <span className="font-semibold">Public Notice:</span>
                        <span className="italic">{service.maintenanceNotice}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditModal(service)}
                        className="text-[11px] text-amber-800 hover:underline cursor-pointer font-bold whitespace-nowrap self-end sm:self-auto"
                      >
                        Edit Downtime Message →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredServices.length === 0 && (
              <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
                <Search className="w-8 h-8 mx-auto mb-3 text-slate-400" />
                <h4 className="text-slate-900 font-bold text-base mb-1">No services matched your query</h4>
                <p className="text-xs mb-4">Try clearing the search input or changing the status filter.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterMode('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Reset Search &amp; Filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE HOMEPAGE PREVIEW SANDBOX */}
      {activeSubTab === 'preview' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-teal-600" />
                  <span>Homepage Pathways Preview Sandbox</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  This preview renders exactly what public visitors see on the MiPAAS Homepage. Unlisted services are completely removed.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/#products"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-2 border border-slate-200 shadow-xs"
                >
                  <span>Open Real Homepage</span>
                  <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
                </Link>
              </div>
            </div>

            {/* Currently Showing on Homepage */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Showing on Homepage ({homepageServices.length} Modules)
                  </h4>
                </div>
                <span className="text-xs text-slate-500">
                  Visible in the interactive accordion/cards
                </span>
              </div>

              {homepageServices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {homepageServices.map((card) => (
                    <div
                      key={card.id}
                      className={`rounded-2xl border p-5 relative overflow-hidden flex flex-col justify-between min-h-[220px] shadow-xs ${
                        card.status !== 'active'
                          ? 'bg-amber-50/50 border-amber-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100"
                            style={{ color: card.accent }}
                          >
                            {card.shortName}
                          </span>

                          {card.status !== 'active' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              Closed (Maint)
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {card.modality}
                            </span>
                          )}
                        </div>

                        <h5 className="text-slate-900 font-bold text-base leading-snug mb-2">
                          {card.name}
                        </h5>
                        <p className="text-xs text-slate-600 line-clamp-3">
                          {card.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => toggleHomepageListing(card.id, false)}
                          className="text-slate-500 hover:text-amber-800 flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          <span>Unlist from Home</span>
                        </button>

                        <span className="text-teal-700 font-semibold">
                          {card.status === 'active' ? 'Operational →' : 'Maintenance'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-slate-500">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-600" />
                  <p className="text-sm font-semibold text-slate-900">All services are currently unlisted!</p>
                  <p className="text-xs mt-1">Homepage visitors will see the platform maintenance placeholder.</p>
                </div>
              )}
            </div>

            {/* Currently Hidden / Unlisted */}
            <div className="pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <h4 className="text-sm font-bold text-slate-700">
                  Hidden / Unlisted from Homepage ({services.filter((s) => !s.isListedOnHomepage).length} Modules)
                </h4>
              </div>

              {services.filter((s) => !s.isListedOnHomepage).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {services
                    .filter((s) => !s.isListedOnHomepage)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-500">{item.modality} • Hidden from Home</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleHomepageListing(item.id, true)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3 h-3 text-emerald-700" />
                          <span>List Again</span>
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No services are currently unlisted.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT & HISTORY */}
      {activeSubTab === 'audit' && (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                <span>Website Service Change Audit Trail</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Chronological record of visibility toggles, downtime activations, and notices.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {serviceAuditLogs.length} events logged
            </span>
          </div>

          <div className="space-y-3">
            {serviceAuditLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold flex-shrink-0 text-xs">
                    {log.action === 'status_change' ? 'PWR' : log.action === 'homepage_visibility' ? 'VIS' : 'CFG'}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-900 font-bold">{log.serviceName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono font-medium">
                        {log.action}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{log.changeDescription}</p>
                  </div>
                </div>

                <div className="text-right text-slate-500 text-[11px] flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1">
                  <span className="text-slate-700 font-medium">By: {log.performedBy} ({log.role})</span>
                  <span className="text-slate-400 font-mono">{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EDIT CONFIG MODAL */}
      {editingService && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setEditingService(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs"
                style={{ backgroundColor: `${editingService.accent}30`, border: `1px solid ${editingService.accent}60` }}
              >
                <span style={{ color: editingService.accent }}>{editingService.modality}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{editingService.name}</h3>
                <span className="text-xs text-slate-500">Configure Downtime &amp; Public Notices</span>
              </div>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Maintenance Reason Category
                </label>
                <select
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value as MaintenanceReason)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
                >
                  <option value="scheduled_maintenance">Scheduled Platform Maintenance</option>
                  <option value="model_calibration">Model Retraining &amp; Calibration</option>
                  <option value="high_load">Inference Queue Load Shedding</option>
                  <option value="emergency_fix">Emergency Hardware / Network Fix</option>
                  <option value="compliance_review">HIPAA / FDA Compliance Audit</option>
                  <option value="other">Other Clinical Operational Review</option>
                </select>
              </div>

              {/* Notice text */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Public Notice Message
                </label>
                <textarea
                  rows={3}
                  value={editNotice}
                  onChange={(e) => setEditNotice(e.target.value)}
                  placeholder="Displayed to clinicians and patients if this service is closed..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white"
                />
              </div>

              {/* Estimated Restore */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Estimated Reopening Time (ETA)
                </label>
                <input
                  type="text"
                  value={editEta}
                  onChange={(e) => setEditEta(e.target.value)}
                  placeholder="e.g. In 2 hours, Today at 18:00 UTC, Tomorrow at 09:00 AM"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white"
                />
              </div>

              {/* Current Status Preview in Modal */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-700">
                <span>Homepage Status:</span>
                <span className={editingService.isListedOnHomepage ? 'text-emerald-700 font-bold' : 'text-indigo-700 font-bold'}>
                  {editingService.isListedOnHomepage ? 'Listed on Homepage' : 'Unlisted (Hidden)'}
                </span>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-white" />
                      <span>Save Parameters</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
