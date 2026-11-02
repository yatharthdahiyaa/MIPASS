'use client';

import React from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  DollarSign,
  HardDrive,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';

export default function PlatformHealthModule() {
  const { session } = useMultiLevelAdmin();

  if (session.level !== 'level_0_platform') {
    return (
      <div className="p-8 rounded-2xl border border-red-500/30 bg-red-950/20 text-center space-y-2">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
        <h3 className="font-bold text-white text-base">Restricted Module</h3>
        <p className="text-gray-400 text-xs">Platform SRE Infrastructure Health is reserved strictly for Level 0 Platform Staff.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Platform SRE Telemetry & GPU Inference Cluster Health
          </h1>
          <p className="text-gray-400 mt-1">
            Global inference queue depths, model latency percentiles, compute cost tracking, and incident logs.
          </p>
        </div>

        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
          <CheckCircle2 className="w-4 h-4" />
          <span>All 6 Cloud Microservices Operational</span>
        </span>
      </div>

      {/* SRE KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-1">
          <span className="text-gray-400 text-[11px]">Total Inference Queue Depth</span>
          <div className="text-2xl font-bold text-white font-mono">4 studies</div>
          <span className="text-emerald-400 text-[11px]">Nominal (Max limit 50)</span>
        </div>

        <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-1">
          <span className="text-gray-400 text-[11px]">p99 Model Inference Latency</span>
          <div className="text-2xl font-bold text-teal-300 font-mono">1.82s</div>
          <span className="text-teal-400 text-[11px]">Sybil-CT ResNet+Transformer</span>
        </div>

        <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-1">
          <span className="text-gray-400 text-[11px]">GPU Utilization</span>
          <div className="text-2xl font-bold text-white font-mono">68.4%</div>
          <span className="text-gray-400 text-[11px]">12x NVIDIA A100 SXM4 (ap-south-1)</span>
        </div>

        <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-1">
          <span className="text-gray-400 text-[11px]">Today's Cloud Compute Cost</span>
          <div className="text-2xl font-bold text-amber-300 font-mono">₹ 14,820</div>
          <span className="text-gray-400 text-[11px]">Projected ₹ 4,45,000 / month</span>
        </div>
      </div>

      {/* Latency by Model Engine */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl border border-white/10 bg-[#0E273A]/60 backdrop-blur-md space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-400" />
            <span>Latency Percentiles by Model Service</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between text-white">
                <span>Sybil Lung Cancer (LDCT 3D Volumes)</span>
                <span className="text-teal-400 font-bold">p50: 1.2s · p99: 1.82s</span>
              </div>
              <div className="text-[10px] text-gray-500">Error rate: 0.002% · 9,200 runs today</div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between text-white">
                <span>qStroke Head CT (ICH Detection)</span>
                <span className="text-teal-400 font-bold">p50: 0.8s · p99: 1.15s</span>
              </div>
              <div className="text-[10px] text-gray-500">Error rate: 0.000% · 5,104 runs today</div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between text-white">
                <span>NeuroOnco Brain MRI (Multi-Modal 4-Channel)</span>
                <span className="text-teal-400 font-bold">p50: 2.1s · p99: 2.94s</span>
              </div>
              <div className="text-[10px] text-gray-500">Error rate: 0.004% · 2,500 runs today</div>
            </div>
          </div>
        </div>

        {/* SRE Incident History */}
        <div className="p-5 rounded-2xl border border-white/10 bg-[#0E273A]/60 backdrop-blur-md space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <span>Recent SRE Incidents & Post-Mortems</span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-white">INC-8819: C-ECHO DICOM TLS Jitter</span>
                <span className="text-emerald-400 font-mono text-[11px]">Resolved</span>
              </div>
              <p className="text-gray-400 text-[11px]">
                Brief 2.4-minute TCP keepalive stall on Indraprastha Apollo WAN gateway. Failover to secondary node executed cleanly.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-white">INC-8742: Auto-Scaling GPU Warm Pool Depletion</span>
                <span className="text-emerald-400 font-mono text-[11px]">Resolved</span>
              </div>
              <p className="text-gray-400 text-[11px]">
                Morning 09:00 IST batch load surge caused 3.8s p99 spike. Warm reserve pool increased from 2 to 4 standby instances.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
