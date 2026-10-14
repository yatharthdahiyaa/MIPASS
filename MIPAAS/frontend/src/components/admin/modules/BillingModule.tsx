'use client';

import React, { useState } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import {
  ArrowDownRight,
  BarChart3,
  Building,
  CreditCard,
  Download,
  FileText,
  PieChart,
  Receipt,
  TrendingUp,
} from 'lucide-react';

export default function BillingModule() {
  const { activeOrg, hasPermission } = useMultiLevelAdmin();

  const [invoices] = useState([
    {
      id: 'INV-2026-0901',
      date: '2026-10-01',
      scansProcessed: '18,420 Scans',
      subtotalInr: '₹ 15,65,700',
      gstInr: '₹ 2,81,826 (18% GST)',
      totalInr: '₹ 18,47,526',
      status: 'Paid (NEFT/RTGS)',
    },
    {
      id: 'INV-2026-0801',
      date: '2026-09-01',
      scansProcessed: '16,210 Scans',
      subtotalInr: '₹ 13,77,850',
      gstInr: '₹ 2,48,013 (18% GST)',
      totalInr: '₹ 16,25,863',
      status: 'Paid (NEFT/RTGS)',
    },
  ]);

  return (
    <div className="space-y-6 text-xs text-gray-200 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Enterprise Invoicing, Usage Slabs & Cost Allocation (₹ INR)
          </h1>
          <p className="text-gray-400 mt-1">
            Indian diagnostic tier reconciliations, 18% GST compliance, and per-scan model breakdown for{' '}
            <strong className="text-white">{activeOrg.name}</strong>.
          </p>
        </div>

        <button
          onClick={() => alert('GST Invoicing tax statement downloaded.')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium"
        >
          <Download className="w-3.5 h-3.5 text-teal-400" />
          <span>Download GST Reconciliation (PDF)</span>
        </button>
      </div>

      {/* KPI Cards: Current Month Spend & Tier Plan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-1">
          <div className="text-gray-400 text-xs">Current Billing Cycle Accrual</div>
          <div className="text-2xl font-bold text-white font-mono">₹ 14,28,400</div>
          <div className="text-[11px] text-teal-400 font-mono">16,804 Scans Processed this Month</div>
        </div>

        <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-1">
          <div className="text-gray-400 text-xs">Contract Plan Tier</div>
          <div className="text-2xl font-bold text-teal-300">Enterprise Slab B</div>
          <div className="text-[11px] text-gray-400">₹ 85 INR / scan base (up to 20,000 scans)</div>
        </div>

        <div className="p-4 rounded-2xl border border-white/10 bg-[#0E273A]/70 backdrop-blur-md space-y-1">
          <div className="text-gray-400 text-xs">GST Tax Registration (India)</div>
          <div className="text-lg font-bold text-white font-mono">07AAAAA0000A1Z5</div>
          <div className="text-[11px] text-emerald-400">18% IGST / CGST+SGST Compliant</div>
        </div>
      </div>

      {/* Usage Breakdown by Model & Site */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model Breakdown */}
        <div className="p-5 rounded-2xl border border-white/10 bg-[#0E273A]/60 backdrop-blur-md space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-teal-400" />
            <span>Usage & Cost Allocation by Model Engine</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between text-white font-bold">
                <span>Sybil Lung Cancer (LDCT)</span>
                <span>₹ 7,82,000 (54.7%)</span>
              </div>
              <div className="text-[11px] text-gray-400">9,200 studies analyzed @ ₹ 85/study</div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between text-white font-bold">
                <span>qStroke Acute ICH (Head CT)</span>
                <span>₹ 4,33,840 (30.4%)</span>
              </div>
              <div className="text-[11px] text-gray-400">5,104 studies analyzed @ ₹ 85/study</div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex justify-between text-white font-bold">
                <span>NeuroOnco Brain Tumor (MRI)</span>
                <span>₹ 2,12,560 (14.9%)</span>
              </div>
              <div className="text-[11px] text-gray-400">2,500 studies analyzed @ ₹ 85/study</div>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="p-5 rounded-2xl border border-white/10 bg-[#0E273A]/60 backdrop-blur-md space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-purple-400" />
            <span>Past GST Tax Invoices</span>
          </h3>

          <div className="space-y-2.5">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white font-mono">{inv.id}</div>
                  <div className="text-[11px] text-gray-400">
                    {inv.date} · {inv.scansProcessed}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-teal-300 font-mono">{inv.totalInr}</div>
                  <div className="text-[10px] text-emerald-400 font-medium">{inv.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
