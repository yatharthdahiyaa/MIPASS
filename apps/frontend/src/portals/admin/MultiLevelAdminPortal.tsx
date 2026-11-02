'use client';

import React from 'react';
import {
  MultiLevelAdminProvider,
  useMultiLevelAdmin,
} from '@/context/MultiLevelAdminContext';
import TopBar from './common/TopBar';
import LeftSidebar from './common/LeftSidebar';
import ContextBanner from './common/ContextBanner';
import OverviewModule from './modules/OverviewModule';
import OrganizationsModule from './modules/OrganizationsModule';
import UsersModule from './modules/UsersModule';
import RolesModule from './modules/RolesModule';
import ApprovalsModule from './modules/ApprovalsModule';
import ModelsAgentsModule from './modules/ModelsAgentsModule';
import ClinicalOpsModule from './modules/ClinicalOpsModule';
import PrivacyConsentModule from './modules/PrivacyConsentModule';
import IntegrationsModule from './modules/IntegrationsModule';
import BillingModule from './modules/BillingModule';
import AuditLogModule from './modules/AuditLogModule';
import PlatformHealthModule from './modules/PlatformHealthModule';
import WebsiteServiceManager from './WebsiteServiceManager';
import { AlertCircle, Lock, ShieldAlert, Sparkles } from 'lucide-react';

function ModuleContainer() {
  const { activeModule, canAccessModule, explainMissingPermission, simulateRole, activeRole } =
    useMultiLevelAdmin();

  // If user lacks permission to access this module, display a helpful "No Access" state
  if (!canAccessModule(activeModule)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4 max-w-md mx-auto">
        <div className="p-4 rounded-3xl bg-red-950/40 border border-red-500/40 text-red-400">
          <Lock className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Access Restricted</h2>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            {explainMissingPermission(activeModule, 'read')}
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-gray-300 w-full space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Current Sign-in Role:</span>
            <span className="font-semibold text-white">{activeRole.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Role Hierarchy:</span>
            <span className="font-mono text-teal-400">{activeRole.levelLabel}</span>
          </div>
        </div>

        <button
          onClick={() => simulateRole('role_platform_owner')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-black font-bold text-xs transition-colors shadow-lg"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Simulate as Platform Owner (Full Bypass)</span>
        </button>
      </div>
    );
  }

  // Active module routing
  switch (activeModule) {
    case 'overview':
      return <OverviewModule />;
    case 'organisations':
    case 'sites':
      return <OrganizationsModule />;
    case 'users':
      return <UsersModule />;
    case 'roles':
      return <RolesModule />;
    case 'approvals':
    case 'breakglass':
      return <ApprovalsModule />;
    case 'models':
    case 'agents':
    case 'thresholds':
      return <ModelsAgentsModule />;
    case 'clinical_ops':
      return <ClinicalOpsModule />;
    case 'privacy_consent':
      return <PrivacyConsentModule />;
    case 'integrations':
      return <IntegrationsModule />;
    case 'billing':
      return <BillingModule />;
    case 'audit':
      return <AuditLogModule />;
    case 'platform_health':
      return <PlatformHealthModule />;
    case 'website_cms':
      return <WebsiteServiceManager />;
    default:
      return <OverviewModule />;
  }
}

function MainAdminLayout() {
  const { theme } = useMultiLevelAdmin();

  return (
    <div
      className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#0A1823] text-white' : 'bg-gray-900 text-white'
      }`}
    >
      {/* Top Bar */}
      <TopBar />

      {/* Persistent Tenant & Elevated Countdown Banner */}
      <ContextBanner />

      {/* Main Workspace: Left Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-105px)]">
          <ModuleContainer />
        </main>
      </div>
    </div>
  );
}

export default function MultiLevelAdminPortal() {
  return (
    <MultiLevelAdminProvider>
      <MainAdminLayout />
    </MultiLevelAdminProvider>
  );
}
