'use client';

import React, { useState } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import {
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  KeyRound,
  Network,
  Plus,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import SensitiveActionModal from '../common/SensitiveActionModal';

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scope: string;
  createdAt: string;
  expiresAt: string;
  lastUsed: string;
}

export default function IntegrationsModule() {
  const { activeOrg, activeSite, hasPermission, addAuditLog } = useMultiLevelAdmin();

  const [activeTab, setActiveTab] = useState<'pacs' | 'apikeys' | 'webhooks' | 'ip'>('pacs');

  // PACS C-ECHO state
  const [echoRunning, setEchoRunning] = useState(false);
  const [echoResult, setEchoResult] = useState<{ status: 'success' | 'failed'; latencyMs: number } | null>(null);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([
    {
      id: 'key_prod_01',
      name: 'GE Centricity PACS Gateway Node',
      prefix: 'mip_live_8849...',
      scope: 'DICOM Ingestion & C-STORE Push',
      createdAt: '2026-09-01',
      expiresAt: '2026-12-01 (90 days)',
      lastUsed: '4 mins ago',
    },
    {
      id: 'key_prod_02',
      name: 'Apollo Hospital EHR FHIR R4 Webhook',
      prefix: 'mip_live_1120...',
      scope: 'Diagnostic Report Read/Write',
      createdAt: '2026-09-14',
      expiresAt: '2026-12-14 (90 days)',
      lastUsed: '12 mins ago',
    },
  ]);

  const [newKeyModalOpen, setNewKeyModalOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const canManageIntegrations = hasPermission('integrations', 'create', 'organisation');

  const runCEcho = () => {
    setEchoRunning(true);
    setEchoResult(null);
    setTimeout(() => {
      setEchoRunning(false);
      setEchoResult({ status: 'success', latencyMs: 18 });
      addAuditLog({
        action: 'pacs:c_echo',
        resource: 'integrations',
        scope: 'site',
        reason: `DICOM C-ECHO ping succeeded against AE ${activeSite.pacsAeTitle} (18ms)`,
      });
    }, 1200);
  };

  const handleGenerateApiKey = (name: string, scope: string) => {
    const rawKey = `mip_live_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    const newItem: ApiKeyItem = {
      id: `key_${Date.now()}`,
      name,
      prefix: `${rawKey.substring(0, 12)}...`,
      scope,
      createdAt: 'Today',
      expiresAt: 'In 90 days',
      lastUsed: 'Never',
    };
    setApiKeys([newItem, ...apiKeys]);
    setGeneratedKey(rawKey);
    addAuditLog({
      action: 'apikeys:create',
      resource: 'integrations',
      scope: 'organisation',
      reason: `Generated scoped API key "${name}" for ${activeOrg.name}`,
    });
  };

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Integrations, PACS DICOM Gateways & API Management
          </h1>
          <p className="text-gray-400 mt-1">
            DIMSE routing, DICOMweb endpoints, HL7 ORU result gateways, and scoped expiring API tokens.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('pacs')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'pacs' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>PACS & C-ECHO</span>
          </button>
          <button
            onClick={() => setActiveTab('apikeys')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'apikeys' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-gray-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>API Keys ({apiKeys.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('ip')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'ip' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>IP Allow-List</span>
          </button>
        </div>
      </div>

      {activeTab === 'pacs' ? (
        /* PACS Gateway & Live C-ECHO tester */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl border border-white/10 bg-[#0E273A]/80 backdrop-blur-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <Server className="w-4 h-4 text-teal-400" />
                <span>PACS Node Configuration ({activeSite.name})</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LISTENING
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-gray-400 text-[11px] mb-1">Local Application Entity (AE) Title:</label>
                <input
                  readOnly
                  value={activeSite.pacsAeTitle}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-[11px] mb-1">DICOM DIMSE Listen Port:</label>
                <input
                  readOnly
                  value="11112 (TLS 1.3 Encrypted)"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-teal-300"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-[11px] mb-1">DICOMweb STOW-RS URL:</label>
                <input
                  readOnly
                  value={`https://dicom.${activeOrg.code.toLowerCase()}.mipaas.internal/studies`}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-gray-300 text-[11px]"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={runCEcho}
                disabled={echoRunning}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-black font-bold transition-all shadow-md"
              >
                <RefreshCw className={`w-4 h-4 ${echoRunning ? 'animate-spin' : ''}`} />
                <span>{echoRunning ? 'Sending C-ECHO Verification...' : 'Execute DICOM C-ECHO Diagnostic'}</span>
              </button>
            </div>

            {echoResult && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in duration-200">
                <span className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>C-ECHO SUCCESS: Response 0x0000 Status Success</span>
                </span>
                <span className="font-mono">{echoResult.latencyMs}ms roundtrip</span>
              </div>
            )}
          </div>

          {/* PACS Routing Protocol Guidelines */}
          <div className="p-5 rounded-2xl border border-white/10 bg-[#0E273A]/60 backdrop-blur-md space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Network className="w-4 h-4 text-purple-400" />
              <span>Diagnostic Network DICOM Rules</span>
            </h3>
            <p className="text-gray-300 text-xs leading-relaxed">
              MIPaaS listens for C-STORE pushes from GE Centricity, Siemens syngo.via, and Philips Vue PACS nodes.
              Incoming series are validated for anonymization compliance before being routed to the AI inference pipeline.
            </p>
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-[11px] space-y-1 font-mono text-gray-400">
              <div>SOP Class: 1.2.840.10008.5.1.4.1.1.2 (CT Image Storage)</div>
              <div>Transfer Syntax: 1.2.840.10008.1.2.4.70 (JPEG Lossless)</div>
              <div>ABDM Consent Token Header: X-ABDM-Consent-Artifact-ID</div>
            </div>
          </div>
        </div>
      ) : activeTab === 'apikeys' ? (
        /* Scoped Expiring API Keys List */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-xs">
              Production API keys are scoped, non-transferable, and expire automatically after 90 days.
            </p>

            {canManageIntegrations && (
              <button
                onClick={() => {
                  const name = prompt('Enter descriptive key label (e.g. Apollo Delhi CT Gateway):');
                  if (name) handleGenerateApiKey(name, 'DICOM Ingest & Report Read');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-black font-bold"
              >
                <Plus className="w-3.5 h-3.5 text-black" />
                <span>Issue New Scoped API Key</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md flex items-center justify-between gap-4 flex-wrap shadow-lg"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white text-sm">{key.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      {key.prefix}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono">
                    Scope: <strong className="text-gray-200">{key.scope}</strong> · Expires: {key.expiresAt} · Last used: {key.lastUsed}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setApiKeys(apiKeys.filter((k) => k.id !== key.id));
                    addAuditLog({
                      action: 'apikeys:revoke',
                      resource: 'integrations',
                      scope: 'organisation',
                      reason: `Revoked API key ${key.name} (${key.prefix})`,
                    });
                  }}
                  className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-300"
                  title="Revoke API Key immediately"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* IP Allow List */
        <div className="p-5 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-3 max-w-xl">
          <h3 className="font-bold text-sm text-white">Configured Gateway IP Whitelist</h3>
          <p className="text-gray-400 text-xs">Only authorized static WAN IPs may establish TLS DIMSE connections.</p>
          <div className="space-y-2 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex justify-between">
              <span>103.21.244.18/32 (Indraprastha Hospital Lease)</span>
              <span className="text-emerald-400">Active</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex justify-between">
              <span>14.139.60.2/32 (Bannerghatta Central Lab Gateway)</span>
              <span className="text-emerald-400">Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Shown Once API Key Reveal Modal */}
      {generatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-3xl border border-teal-500/50 p-6 shadow-2xl text-white space-y-4"
            style={{ backgroundColor: '#0A1823' }}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-base text-teal-400 flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                <span>API Key Generated (Shown Once)</span>
              </span>
              <button onClick={() => setGeneratedKey(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Please copy your secret key immediately. For security, this secret token cannot be viewed again.
            </p>

            <div className="p-3 rounded-xl bg-black/60 border border-teal-500/40 font-mono text-xs text-teal-300 break-all select-all flex items-center justify-between">
              <span>{generatedKey}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey);
                  alert('Copied API key to clipboard.');
                }}
                className="p-1.5 rounded-lg bg-teal-500 text-black hover:bg-teal-400 shrink-0 ml-2"
                title="Copy to clipboard"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setGeneratedKey(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs"
            >
              I have stored this secret safely
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
