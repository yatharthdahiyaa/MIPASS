/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Code2,
  Terminal,
  Webhook,
  Key,
  Play,
  Copy,
  Check,
  Send,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export default function DeveloperPortal() {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'docs' | 'webhooks'>('sandbox');
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxOutput, setSandboxOutput] = useState<any>(null);
  const [selectedSdk, setSelectedSdk] = useState<'python' | 'ts' | 'curl'>('python');
  const [copiedCode, setCopiedCode] = useState(false);

  const runSandboxInference = () => {
    setSandboxRunning(true);
    setSandboxOutput(null);
    setTimeout(() => {
      setSandboxRunning(false);
      setSandboxOutput({
        status: '200 OK',
        case_id: 'sandbox_cxr_9941',
        model: 'DenseNet121_ChestXray14_NIH',
        latency_ms: 124,
        inference_results: {
          primary_finding: 'Cardiomegaly',
          confidence: 0.884,
          severity: 'MODERATE',
          findings: [
            { name: 'Cardiomegaly', probability: 0.884, positive: true },
            { name: 'Pleural Effusion', probability: 0.321, positive: false },
            { name: 'Pneumonia', probability: 0.142, positive: false },
          ],
        },
        xai_artifacts: {
          gradcam_overlay_url: 'https://mipaas.app/artifacts/sandbox/gradcam_sample.png',
          lesion_bounding_boxes: [{ x: 124, y: 310, w: 240, h: 180 }],
        },
      });
    }, 800);
  };

  const copySnippet = () => {
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-6 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold uppercase tracking-wider">
                Persona: Developers &amp; Integrators
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                OpenAPI 3.1 &amp; Webhooks Active
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
              Developer Sandbox &amp; API Integration Hub
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Explore interactive synthetic sandboxes, copy official SDK code, configure HMAC-SHA256 webhooks, and manage API tokens.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/agents"
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
            >
              <span>Agent Command Center</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
            </Link>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 mt-6 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('sandbox')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'sandbox'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Synthetic Sandbox Runner</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>API Docs &amp; SDKs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('webhooks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'webhooks'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" />
            <span>Webhooks &amp; Event Feeds</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* TAB 1: SANDBOX */}
        {activeTab === 'sandbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Play className="w-5 h-5 text-teal-600" />
                  <span>Sandbox Request Dispatcher</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Run safe mock inferences using synthetic multi-modality benchmarks without incurring billing or handling real PHI.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Target Endpoint</label>
                  <input
                    type="text"
                    readOnly
                    value="POST https://api.mipaas.app/v1/inference/predict"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-teal-700 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Benchmark Study Profile</label>
                  <select className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white">
                    <option>Synthetic Chest X-Ray: Cardiomegaly / Effusion</option>
                    <option>Synthetic Low-Dose CT: 8mm RUL Nodule</option>
                    <option>Synthetic Dermoscopy: Pigmented Melanocytic Lesion</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Request Headers</label>
                  <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-teal-300">
{`Authorization: Bearer mip_test_sandbox_token_8812
Content-Type: multipart/form-data
X-Tenant-ID: sandbox-hospital-network`}
                  </pre>
                </div>
              </div>

              <button
                type="button"
                onClick={runSandboxInference}
                disabled={sandboxRunning}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all disabled:opacity-50"
              >
                {sandboxRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Inference Engine...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Send Sandbox Inference Request</span>
                  </>
                )}
              </button>
            </div>

            {/* Sandbox Response Output */}
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-teal-600" />
                  <span>Real-time Response Payload</span>
                </span>
                {sandboxOutput && (
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-xs font-bold">
                    {sandboxOutput.status}
                  </span>
                )}
              </div>

              <div className="flex-1 rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs overflow-auto max-h-[420px]">
                {sandboxOutput ? (
                  <pre className="text-teal-300">
                    {JSON.stringify(sandboxOutput, null, 2)}
                  </pre>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 italic">
                    Press &quot;Send Sandbox Inference Request&quot; to inspect live response JSON
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: API DOCS & SDKS */}
        {activeTab === 'docs' && (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Client SDK Integration Snippets</h2>
                <p className="text-xs text-slate-500">Plug-and-play integrations for Python, TypeScript, and standard REST curl.</p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedSdk('python')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedSdk === 'python' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Python
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSdk('ts')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedSdk === 'ts' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  TypeScript
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSdk('curl')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedSdk === 'curl' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  cURL
                </button>
              </div>
            </div>

            <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-5 font-mono text-xs overflow-x-auto">
              <button
                type="button"
                onClick={copySnippet}
                className="absolute right-4 top-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              {selectedSdk === 'python' && (
                <pre className="text-teal-200 leading-relaxed">
{`import mipaas

client = mipaas.Client(api_key="mip_live_your_api_key_here")

# 1. Resumable direct upload
study = client.studies.upload_dicom("patient_scan.dcm")
print(f"Study Validated: {study.pseudonym_id}")

# 2. Trigger asynchronous model inference
prediction = client.inference.predict(
    case_id=study.id,
    model="DenseNet121_ChestXray14",
    generate_gradcam=True
)

for finding in prediction.positive_findings:
    print(f"[{finding.name}]: {finding.probability * 100:.1f}% confidence")`}
                </pre>
              )}

              {selectedSdk === 'ts' && (
                <pre className="text-teal-200 leading-relaxed">
{`import { MipaasClient } from '@mipaas/sdk';

const client = new MipaasClient({ apiKey: process.env.MIPAAS_API_KEY });

async function analyzeStudy(filePath: string) {
  const study = await client.studies.uploadResumable(filePath);
  const result = await client.inference.run({
    studyId: study.id,
    priority: 'URGENT',
    xaiOverlay: true,
  });

  console.log('Primary Diagnosis:', result.primaryDiagnosis);
  console.log('Grad-CAM Heatmap:', result.xai.heatmapUrl);
}`}
                </pre>
              )}

              {selectedSdk === 'curl' && (
                <pre className="text-teal-200 leading-relaxed">
{`curl -X POST https://api.mipaas.app/v1/inference/dicom-predict \\
  -H "Authorization: Bearer mip_live_your_api_key_here" \\
  -F "file=@sample_scan.dcm"`}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: WEBHOOKS */}
        {activeTab === 'webhooks' && (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-teal-600" />
                  <span>Real-Time Webhook Subscriptions</span>
                </h2>
                <p className="text-xs text-slate-500">Receive instant event dispatches when scans are validated, STAT alerts triggered, or reports signed.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900 font-mono">https://api.hospital.internal/mipaas/webhook-listener</div>
                  <div className="text-slate-500 text-[11px] mt-1">
                    Events: <span className="text-teal-700 font-semibold">study.intake.validated</span>, <span className="text-rose-600 font-semibold">case.triaged.stat</span>, <span className="text-emerald-700 font-semibold">report.signed</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px]">
                    200 OK (18ms)
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    Test Ping
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                <span className="text-slate-400 text-[11px] block">HMAC-SHA256 Signature Verification Header:</span>
                <span className="text-teal-300 block">X-MIPAAS-Signature: t=1760314800,v1=9a4f210d7831bb21...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
