'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Key,
  Network,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Shield,
  Clock,
  DollarSign,
  Activity,
  ArrowRight,
  Server,
  Building,
  Check,
  Globe,
  SlidersHorizontal,
  EyeOff,
  PowerOff,
} from 'lucide-react';
import WebsiteServiceManager from '@/components/admin/WebsiteServiceManager';
import { useServices } from '@/context/ServicesContext';

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState<'services' | 'integrations' | 'users' | 'analytics' | 'apikeys'>('services');
  const { services } = useServices();
  const closedCount = services.filter((s) => s.status !== 'active').length;
  const unlistedCount = services.filter((s) => !s.isListedOnHomepage).length;
  const [echoRunning, setEchoRunning] = useState(false);
  const [echoResult, setEchoResult] = useState<string | null>(null);

  const [pacsSettings, setPacsSettings] = useState({
    ae_title: 'MIPAAS_PACS_IN',
    port: '11112',
    ip_address: '10.240.0.12',
    dicomweb_url: 'https://pacs.hospital.internal/dicomweb',
  });

  const [users] = useState([
    { id: 'usr_01', name: 'Dr. Sarah Lin', email: 's.lin@hospital.internal', role: 'Radiologist', site: 'Metro General', mfa: true },
    { id: 'usr_02', name: 'Marcus Vance', email: 'm.vance@hospital.internal', role: 'Lab Technician', site: 'St. Jude Imaging', mfa: true },
    { id: 'usr_03', name: 'Elena Rostova', email: 'e.rostova@hospital.internal', role: 'Lab Admin', site: 'Network HQ', mfa: true },
    { id: 'usr_04', name: 'Dr. David Chen', email: 'd.chen@hospital.internal', role: 'Referring Physician', site: 'Metro General', mfa: false },
  ]);

  const [apiKeys, setApiKeys] = useState([
    { id: 'key_prod_01', label: 'EHR Epic FHIR Sync', prefix: 'mip_live_8849...', created: '2026-09-01', scope: 'Read/Write Ingestion' },
    { id: 'key_pacs_02', label: 'GE PACS Gateway Node', prefix: 'mip_live_1120...', created: '2026-09-14', scope: 'PACS DIMSE Push' },
  ]);

  const runPacsEcho = () => {
    setEchoRunning(true);
    setEchoResult(null);
    setTimeout(() => {
      setEchoRunning(false);
      setEchoResult(`DICOM C-ECHO Verification SCP accepted by ${pacsSettings.ae_title} on port ${pacsSettings.port} (14.2ms RTT).`);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-6 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold uppercase tracking-wider">
                Persona: Lab Admin
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                Multi-Tenant Governance &amp; PACS
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
              Laboratory Administration Hub
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure hospital PACS/HL7/FHIR nodes, manage multi-site users and keys, and audit turnaround latency.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/internal"
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
            >
              <span>Internal ML Console</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'services'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Website &amp; Service Controls</span>
            {(closedCount > 0 || unlistedCount > 0) && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black">
                {closedCount > 0 ? `${closedCount} Closed` : `${unlistedCount} Unlisted`}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('integrations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'integrations'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Integrations (PACS/HL7/FHIR)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users &amp; Sites</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Usage, Billing &amp; TAT</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apikeys')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'apikeys'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* TAB 0: WEBSITE & SERVICE CONTROLS */}
        {activeTab === 'services' && <WebsiteServiceManager />}

        {/* TAB 1: INTEGRATIONS */}
        {activeTab === 'integrations' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Server className="w-5 h-5 text-teal-600" />
                    <span>PACS DICOM DIMSE Endpoint</span>
                  </h2>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-mono font-bold border border-emerald-200">
                    C-STORE SCP LISTENING
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">Application Entity (AE) Title</label>
                    <input
                      type="text"
                      value={pacsSettings.ae_title}
                      onChange={(e) => setPacsSettings({ ...pacsSettings, ae_title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">DIMSE Listening Port</label>
                    <input
                      type="text"
                      value={pacsSettings.port}
                      onChange={(e) => setPacsSettings({ ...pacsSettings, port: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">Local Network IP</label>
                    <input
                      type="text"
                      value={pacsSettings.ip_address}
                      onChange={(e) => setPacsSettings({ ...pacsSettings, ip_address: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">DICOMweb STOW-RS URL</label>
                    <input
                      type="text"
                      value={pacsSettings.dicomweb_url}
                      onChange={(e) => setPacsSettings({ ...pacsSettings, dicomweb_url: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={runPacsEcho}
                    disabled={echoRunning}
                    className="px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
                  >
                    {echoRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                    <span>Run C-ECHO Verification Ping</span>
                  </button>

                  <span className="text-[11px] text-slate-400 font-mono">
                    DICOM PS3.4 Annex A.2 compliant
                  </span>
                </div>

                {echoResult && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-mono">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{echoResult}</span>
                  </div>
                )}
              </div>

              {/* HL7 and FHIR Settings */}
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Network className="w-5 h-5 text-teal-600" />
                  <span>HL7 v2 &amp; FHIR R4 Gateways</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">HL7 v2 MLLP Feed</span>
                      <span className="text-emerald-700 font-bold bg-emerald-100/60 px-2 py-0.5 rounded text-[10px]">CONNECTED</span>
                    </div>
                    <p className="text-slate-500 text-[11px] font-mono">mllp://hl7.hospital.internal:2575</p>
                    <span className="inline-block px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-700 font-medium">
                      ORU^R01 Diagnostics
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">FHIR R4 DiagnosticReport</span>
                      <span className="text-emerald-700 font-bold bg-emerald-100/60 px-2 py-0.5 rounded text-[10px]">ACTIVE</span>
                    </div>
                    <p className="text-slate-500 text-[11px] font-mono">https://fhir.hospital.internal/r4</p>
                    <span className="inline-block px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-700 font-medium">
                      SMART on FHIR OAuth2
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Sidebar */}
            <div className="space-y-6">
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Building className="w-4 h-4 text-teal-600" />
                  <span>Licensed Hospital Sites</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900">Metro General Hospital</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">Primary Tier · 4 DICOM Scanners</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900">St. Jude Imaging Center</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">Regional Site · 2 High-Res CTs</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900">East Valley Diagnostic Lab</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">Outpatient Clinic · 1 CXR Unit</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USERS & ROLES */}
        {activeTab === 'users' && (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Enterprise Role-Based Access Control (RBAC)</h2>
                <p className="text-xs text-slate-500">Scoped roles enforce least privilege across medical and intake workflows.</p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invite User</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Assigned Site</th>
                    <th className="py-3 px-4">MFA Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 font-semibold border border-teal-200 text-[11px]">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{u.site}</td>
                      <td className="py-3 px-4">
                        {u.mfa ? (
                          <span className="text-emerald-700 flex items-center gap-1 font-bold">
                            <Check className="w-3.5 h-3.5" /> Enforced
                          </span>
                        ) : (
                          <span className="text-amber-700 flex items-center gap-1 font-bold">
                            Pending Setup
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ANALYTICS & BILLING */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-xs font-semibold uppercase block">Monthly Inference Spend</span>
                <span className="text-2xl font-extrabold text-slate-900 mt-1 block">$420.50</span>
                <span className="text-[11px] text-slate-400">Cap: $1,500.00 / month</span>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-xs font-semibold uppercase block">Studies Analyzed</span>
                <span className="text-2xl font-extrabold text-teal-700 mt-1 block">1,420</span>
                <span className="text-[11px] text-slate-400">Avg Cost: $0.296 / study</span>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-xs font-semibold uppercase block">Median TAT (Ingest to AI)</span>
                <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">6.8s</span>
                <span className="text-[11px] text-slate-400">P95 SLA: 14.2s</span>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-xs font-semibold uppercase block">STAT Pager Response</span>
                <span className="text-2xl font-extrabold text-teal-800 mt-1 block">2.4 min</span>
                <span className="text-[11px] text-slate-400">Target: &lt; 15 min</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-2">Turnaround Time Distribution</h3>
              <p className="text-xs text-slate-500 mb-6">
                Quantified clinical workflow speedup across all network imaging modalities.
              </p>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-700 font-medium">Chest X-Ray Ingestion to AI Findings (&lt; 10s)</span>
                    <span className="font-mono text-emerald-700 font-bold">98.4% On Target</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: '98.4%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-700 font-medium">3D Volume Low-Dose CT Sybil/ResNet (&lt; 45s)</span>
                    <span className="font-mono text-teal-700 font-bold">94.1% On Target</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-teal-600 rounded-full" style={{ width: '94.1%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-700 font-medium">Clinician Report Turnaround Reduction</span>
                    <span className="font-mono text-teal-800 font-bold">34% Radiologist Time Saved</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-teal-700 rounded-full" style={{ width: '85%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: API KEYS */}
        {activeTab === 'apikeys' && (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Scoped API Credentials</h2>
                <p className="text-xs text-slate-500">Authenticate external PACS push nodes, custom hospital scripts, and EHR webhooks.</p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Key</span>
              </button>
            </div>

            <div className="space-y-3">
              {apiKeys.map((k) => (
                <div key={k.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Key className="w-4 h-4 text-teal-600" />
                      <span>{k.label}</span>
                    </div>
                    <div className="font-mono text-slate-500 mt-1">{k.prefix} · Scope: {k.scope}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[11px] block">Created {k.created}</span>
                    <button type="button" className="text-rose-600 hover:text-rose-700 font-bold text-xs mt-1 cursor-pointer">
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
