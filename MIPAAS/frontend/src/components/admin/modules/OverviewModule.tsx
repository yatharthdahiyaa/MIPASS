'use client';

import React from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building,
  CheckCircle2,
  Clock,
  Cpu,
  DollarSign,
  FileCheck2,
  Flame,
  HeartPulse,
  Layers,
  MapPin,
  Percent,
  Server,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import ScopeBadge from '../common/ScopeBadge';

export default function OverviewModule() {
  const { session, activeOrg, activeSite, activeRole, statAlerts, setActiveModule, language } = useMultiLevelAdmin();

  const isPlatform = session.level === 'level_0_platform';
  const isOrg = session.level === 'level_1_organisation';
  const isSite = session.level === 'level_2_site';
  const isUser = session.level === 'level_3_user';

  // Role-aware KPI metrics
  const totalCasesToday = isPlatform ? 1420 : isOrg ? 621 : isSite ? activeSite.activeCasesToday : 34;
  const statPendingCount = statAlerts.length;
  const slaBreaches = isPlatform ? 2 : isOrg ? 1 : 0;
  const meanTurnaroundTime = '11.4 min';
  const clinicianAgreementRate = '96.8%';
  const monthlyScansUsed = isPlatform ? '42,850' : isOrg ? '18,420' : '4,190';
  const monthlyQuota = isPlatform ? '50,000' : isOrg ? '20,000' : '5,000';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Overview Top Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-wide">
              {language === 'HI' ? 'प्रशासनिक डैशबोर्ड सिंहावलोकन' : 'Executive Overview & Clinical KPIs'}
            </h1>
            <ScopeBadge scope={isPlatform ? 'platform' : isOrg ? 'organisation' : isSite ? 'site' : 'own'} />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Real-time telemetry and compliance tracking for{' '}
            <strong className="text-white">{isPlatform ? 'All Indian Healthcare Networks' : activeOrg.name}</strong> ·{' '}
            <span className="text-teal-400 font-medium">{activeSite.name}</span>
          </p>
        </div>

        {/* Quick STAT emergency alert button */}
        {statPendingCount > 0 && (
          <button
            onClick={() => setActiveModule('clinical_ops')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-bold animate-pulse hover:bg-red-900/60 transition-colors"
          >
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>{statPendingCount} Critical STAT Cases Require Immediate Sign-off</span>
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Cases Today */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Diagnostic Studies Today</span>
            <Activity className="w-4 h-4 text-teal-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{totalCasesToday}</span>
            <span className="text-xs text-emerald-400 flex items-center font-semibold">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +14.2%
            </span>
          </div>
          <div className="text-[11px] text-gray-400 mt-2 flex items-center justify-between">
            <span>CT: 58% · MRI: 24% · XR: 18%</span>
            <span className="font-mono text-teal-400">All PACS online</span>
          </div>
        </div>

        {/* KPI 2: STAT Awaiting Review (Urgent warm amber / coral red) */}
        <div className="p-4 rounded-2xl border border-red-500/30 bg-red-950/20 backdrop-blur-md relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-xs text-red-300 mb-2">
            <span className="font-semibold">STAT Cases Awaiting Review</span>
            <Flame className="w-4 h-4 text-red-400 animate-bounce" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{statPendingCount}</span>
            <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">
              15-Min SLA Window
            </span>
          </div>
          <div className="text-[11px] text-red-200/80 mt-2">
            Oldest waiting: <strong className="text-white font-mono">11m 40s (P-0042)</strong>
          </div>
        </div>

        {/* KPI 3: Turnaround Time & SLA */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Mean Turnaround Time (TAT)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{meanTurnaroundTime}</span>
            <span className="text-xs text-emerald-400 font-semibold font-mono">SLA Target &lt; 20m</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-2 flex items-center justify-between">
            <span>SLA Breaches: <strong className="text-amber-400">{slaBreaches}</strong></span>
            <span className="text-emerald-400 font-semibold">99.2% on-time</span>
          </div>
        </div>

        {/* KPI 4: AI-Clinician Agreement Rate */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>AI vs Clinician Agreement</span>
            <Percent className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{clinicianAgreementRate}</span>
            <span className="text-xs text-purple-400 font-semibold">NABH Benchmarked</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-2 flex items-center justify-between">
            <span>Sybil-CT: 98.2% · Stroke: 97.4%</span>
            <span className="text-teal-400 font-semibold">Validated</span>
          </div>
        </div>
      </div>

      {/* Tier 2: Level-Specific Detailed Sections */}
      {isPlatform && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Platform Infrastructure Health */}
          <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/50 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <div className="flex items-center gap-1.5">
                <Server className="w-4 h-4 text-[#00DCCE]" />
                <span>Cloud Inference Cluster (AWS Mumbai ap-south-1)</span>
              </div>
              <span className="text-emerald-400 font-mono text-[11px] bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                All 6 Nodes Healthy
              </span>
            </div>
            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex justify-between">
                <span>Inference Queue Depth:</span>
                <span className="font-mono text-white font-bold">4 studies</span>
              </div>
              <div className="flex justify-between">
                <span>p99 Model Latency:</span>
                <span className="font-mono text-teal-400">1.82s (Sybil-CT)</span>
              </div>
              <div className="flex justify-between">
                <span>Active GPU Allocation:</span>
                <span className="font-mono text-gray-200">12x NVIDIA A100 (68% util)</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Compute Cost Today:</span>
                <span className="font-mono text-amber-300">₹ 14,820 INR</span>
              </div>
            </div>
          </div>

          {/* Cross-Tenant Hierarchy Overview */}
          <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/50 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <div className="flex items-center gap-1.5">
                <Building className="w-4 h-4 text-[#7C5CFC]" />
                <span>Indian Diagnostic Networks</span>
              </div>
              <span className="text-teal-300 text-[11px] font-mono">3 Active Tenants</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Apollo Hospitals & Labs</div>
                  <div className="text-[10px] text-gray-400">4 sites · 621 cases today</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  Active
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Dr Lal PathLabs Advanced Imaging</div>
                  <div className="text-[10px] text-gray-400">2 sites · 408 cases today</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  Active
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Mahajan Imaging & AI Labs</div>
                  <div className="text-[10px] text-gray-400">1 site · 145 cases today</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Usage vs Plan Quota */}
          <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/50 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-[#F5A623]" />
                <span>Monthly Scan Volume vs Plan</span>
              </div>
              <span className="font-mono text-teal-400 text-[11px]">85.7% Consumed</span>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{monthlyScansUsed} Scans Processed</span>
                <span className="text-gray-300 font-mono">{monthlyQuota} Plan Cap</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-400 to-amber-400"
                  style={{ width: '85.7%' }}
                />
              </div>
            </div>
            <div className="text-[11px] text-gray-400 leading-relaxed">
              Tier slab auto-expands at 95% threshold under the Master Service Agreement. Overage rate:
              ₹ 85 INR per scan.
            </div>
          </div>
        </div>
      )}

      {/* Organisation Level: Site Comparison Table */}
      {!isPlatform && (
        <div className="rounded-2xl border border-white/10 bg-[#0E273A]/60 backdrop-blur-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-teal-400" />
              <h3 className="font-bold text-sm text-white">{activeOrg.name} · Site Workload Matrix</h3>
            </div>
            <span className="text-xs text-gray-400 font-mono">Live PACS AE Listeners</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {activeOrg.sites.map((site) => (
              <div
                key={site.id}
                className={`p-3 rounded-xl border transition-all ${
                  site.id === activeSite.id
                    ? 'bg-teal-500/10 border-teal-500/40 text-white'
                    : 'bg-white/[0.02] border-white/10 text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs truncate">{site.name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      site.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-gray-400 font-mono mb-2">AE: {site.pacsAeTitle}</div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                  <span>Cases Today: <strong className="text-white">{site.activeCasesToday}</strong></span>
                  <span className="text-red-400 font-bold">{site.statQueueDepth} STAT</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
