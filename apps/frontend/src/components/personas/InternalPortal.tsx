'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Layers,
  Activity,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Database,
  Building,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Fingerprint
} from 'lucide-react';

export default function InternalPortal() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'tenants' | 'drift' | 'audit'>('catalog');
  const [auditQuery, setAuditQuery] = useState('');

  const [models] = useState([
    {
      id: 'DenseNet121_ChestXray14',
      name: 'NIH ChestX-ray14 DenseNet-121',
      version: 'v2.4.1',
      stage: 'Production',
      clearance: 'FDA 510(k) · CE Class IIa',
      override_rate: '8.8%',
      psi_drift: '0.042 (Normal)',
      modality: 'CXR',
    },
    {
      id: 'ResNet3D_Lung',
      name: '3D ResNet Nodule Classifier',
      version: 'v1.8.0',
      stage: 'Production',
      clearance: 'CE Class IIa',
      override_rate: '6.4%',
      psi_drift: '0.028 (Normal)',
      modality: 'Chest CT',
    },
    {
      id: 'Sybil_LDCT',
      name: 'Sybil LDCT 6-Year Risk Forecaster',
      version: 'v3.1.0',
      stage: 'Canary (10%)',
      clearance: 'RUO (Validation Cohort)',
      override_rate: '11.2%',
      psi_drift: '0.089 (Normal)',
      modality: 'Low-Dose CT',
    },
    {
      id: 'HAM10000_EffNet',
      name: 'HAM10000 EfficientNet-B0 Dermoscopy',
      version: 'v1.2.0',
      stage: 'Production',
      clearance: 'CE Class I',
      override_rate: '4.9%',
      psi_drift: '0.019 (Normal)',
      modality: 'Dermoscopy',
    },
  ]);

  const [tenantMatrix, setTenantMatrix] = useState([
    {
      tenant_id: 'hospital_metro_general',
      name: 'Metro General Hospital',
      models: { DenseNet121_ChestXray14: true, ResNet3D_Lung: true, Sybil_LDCT: true, HAM10000_EffNet: false },
    },
    {
      tenant_id: 'hospital_st_jude',
      name: 'St. Jude Imaging Center',
      models: { DenseNet121_ChestXray14: true, ResNet3D_Lung: true, Sybil_LDCT: false, HAM10000_EffNet: true },
    },
    {
      tenant_id: 'clinic_east_valley',
      name: 'East Valley Outpatient Clinic',
      models: { DenseNet121_ChestXray14: true, ResNet3D_Lung: false, Sybil_LDCT: false, HAM10000_EffNet: false },
    },
  ]);

  const toggleTenantModel = (tenantIdx: number, modelId: string) => {
    setTenantMatrix((prev) => {
      const copy = [...prev];
      const cur = copy[tenantIdx].models[modelId as keyof typeof copy[0]['models']];
      copy[tenantIdx].models = { ...copy[tenantIdx].models, [modelId]: !cur };
      return copy;
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-6 md:p-8">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold uppercase tracking-wider">
                Persona: Internal Platform &amp; ML Team
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                Model QA (L0) &amp; Canary Rollout
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
              Internal ML Operations &amp; Governance Console
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Govern model catalog lifecycles, configure per-tenant model enablement flags, monitor override drift, and inspect immutable audit trails.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/developer"
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
            >
              <span>Developer Hub</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Model Catalog &amp; Registry</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'tenants'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Per-Tenant Enablement</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drift')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'drift'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Override Rates &amp; Drift QA</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Immutable Audit Search</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* TAB 1: MODEL CATALOG */}
        {activeTab === 'catalog' && (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Central Production &amp; Canary Model Catalog</h2>
                <p className="text-xs text-slate-500">Strict separation between cleared clinical algorithms and experimental canary weights.</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Model Architecture</th>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4">Deployment Stage</th>
                    <th className="py-3 px-4">Regulatory Clearance</th>
                    <th className="py-3 px-4">Clinician Override</th>
                    <th className="py-3 px-4">Drift (PSI)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {models.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-teal-600" />
                          <span>{m.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{m.modality}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{m.version}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded font-bold text-[10px] ${
                            m.stage.includes('Production')
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-teal-50 text-teal-800 border border-teal-200'
                          }`}
                        >
                          {m.stage}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{m.clearance}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{m.override_rate}</td>
                      <td className="py-3 px-4 font-mono text-emerald-700 font-bold">{m.psi_drift}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: TENANT ENABLEMENT */}
        {activeTab === 'tenants' && (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900">Per-Tenant Feature Flag &amp; Model Routing Matrix</h2>
              <p className="text-xs text-slate-500">Instantly toggle models for specific healthcare facilities and contract tiers without redeployment.</p>
            </div>

            <div className="space-y-4">
              {tenantMatrix.map((t, idx) => (
                <div key={t.tenant_id} className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-4">
                    <Building className="w-4 h-4 text-teal-600" />
                    <span>{t.name}</span>
                    <span className="text-xs font-mono text-slate-400">({t.tenant_id})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    {models.map((m) => {
                      const enabled = t.models[m.id as keyof typeof t.models];
                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all shadow-xs ${
                            enabled
                              ? 'bg-white border-teal-300 text-slate-900'
                              : 'bg-slate-100/70 border-slate-200 text-slate-400'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-xs block">{m.name.split(' ')[0]}</span>
                            <span className="text-[10px] text-slate-400 block">{m.modality}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleTenantModel(idx, m.id)}
                            className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${
                              enabled ? 'bg-teal-600' : 'bg-slate-300'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                                enabled ? 'right-1' : 'left-1'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DRIFT & QA */}
        {activeTab === 'drift' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
                <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Clinician Override Benchmark</span>
                <span className="text-3xl font-extrabold text-slate-900 block">8.8%</span>
                <span className="text-xs text-emerald-700 flex items-center gap-1 mt-2 font-medium">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Within &lt; 12% safety tolerance</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-3">
                  Agent 8 (Model QA L0) automatically flags any model exceeding 12% overrides across 100+ cases.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
                <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Population Stability (PSI)</span>
                <span className="text-3xl font-extrabold text-teal-700 block">0.042</span>
                <span className="text-xs text-emerald-700 flex items-center gap-1 mt-2 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Zero statistical distribution shift</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-3">
                  Kolmogorov-Smirnov feature attribution stable between training baseline and live inference.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
                <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Site Discrepancy Alert</span>
                <span className="text-3xl font-extrabold text-amber-700 block">1 Site</span>
                <span className="text-xs text-amber-800 flex items-center gap-1 mt-2 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>St. Jude Siemens Somatom &gt; 3mm</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-3">
                  Higher slice thickness causes 3.2% rise in vessel false-positives; recalibration recommended.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-4">Top Clinician Override Reasons Captured</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-900">FALSE_POSITIVE_VESSEL_CONGESTION</span>
                  <span className="font-mono text-slate-500">54.5% of overrides (12 cases)</span>
                </div>
                <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-900">RESPIRATORY_MOTION_ARTIFACT_CONFUSION</span>
                  <span className="font-mono text-slate-500">27.3% of overrides (6 cases)</span>
                </div>
                <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-900">DIMENSION_RECALIBRATED_BY_MANUAL_CALIPER</span>
                  <span className="font-mono text-slate-500">18.2% of overrides (4 cases)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT SEARCH */}
        {activeTab === 'audit' && (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <span>Immutable Cryptographic Audit Trail</span>
              </h2>
              <p className="text-xs text-slate-500">WORM (Write-Once-Read-Many) compliant logs for FDA 21 CFR Part 11 and HIPAA compliance.</p>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search by case hash, operator ID, or digital signature..."
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white"
              />
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>Verify Chained Hash</span>
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                <div>
                  <span className="text-emerald-700 font-bold block">[REPORT_SIGNED] Case: MIP-9901-STAT</span>
                  <span className="text-slate-500 text-[11px]">Actor: DR-RAD-4412 · Timestamp: 2026-10-13T00:15:22Z</span>
                </div>
                <span className="text-[10px] text-slate-400">Hash: sha256-e3b0c44298fc1c14...</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                <div>
                  <span className="text-teal-700 font-bold block">[OVERRIDE_RECORDED] Case: MIP-9901-STAT</span>
                  <span className="text-slate-500 text-[11px]">Finding: fnd_02 · Code: FALSE_POSITIVE_MOTION</span>
                </div>
                <span className="text-[10px] text-slate-400">Hash: sha256-9a4f210d7831bb21...</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                <div>
                  <span className="text-teal-800 font-bold block">[XAI_GRADCAM_COMPUTED] Case: MIP-9902-URGENT</span>
                  <span className="text-slate-500 text-[11px]">Worker: Cloud Run GPU-04 · Latency: 12.4s</span>
                </div>
                <span className="text-[10px] text-slate-400">Hash: sha256-4c728e9198aa4001...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
