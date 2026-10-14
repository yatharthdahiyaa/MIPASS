import React from 'react';
import { ArrowRight, FileCode } from 'lucide-react';

interface DiffItem {
  field: string;
  before: any;
  after: any;
}

interface AuditDiffProps {
  diffs?: DiffItem[];
}

export default function AuditDiff({ diffs }: AuditDiffProps) {
  if (!diffs || diffs.length === 0) {
    return (
      <div className="text-gray-500 text-xs italic py-1">
        No state mutation diff recorded for this read operation.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden font-mono text-xs">
      <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
        <FileCode className="w-3.5 h-3.5 text-teal-400" />
        <span>State Mutation Diff (Before / After)</span>
      </div>
      <div className="divide-y divide-white/5">
        {diffs.map((d, idx) => (
          <div key={idx} className="p-2.5 flex items-start justify-between gap-3 flex-wrap">
            <span className="font-semibold text-gray-300 min-w-[120px]">{d.field}:</span>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Before */}
              <span className="px-2 py-0.5 rounded bg-red-950/40 border border-red-500/30 text-red-300 line-through">
                {JSON.stringify(d.before)}
              </span>

              <ArrowRight className="w-3 h-3 text-gray-500 shrink-0" />

              {/* After */}
              <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-bold">
                {JSON.stringify(d.after)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
