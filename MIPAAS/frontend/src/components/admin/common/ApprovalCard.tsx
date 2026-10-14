import React from 'react';
import { Check, Clock, ShieldAlert, UserCheck, X } from 'lucide-react';
import ScopeBadge from './ScopeBadge';
import { PermissionScope } from '@/types/multiLevelRbac';

interface ApprovalCardProps {
  id: string;
  title: string;
  requesterName: string;
  requesterRole: string;
  targetOrg: string;
  scope: PermissionScope;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  timestamp?: string;
  expiresInMinutes?: number;
  firstSigner?: string;
  requiresSecondSigner?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  diffSummary?: { field: string; before: any; after: any }[];
}

export default function ApprovalCard({
  id,
  title,
  requesterName,
  requesterRole,
  targetOrg,
  scope,
  reason,
  status,
  timestamp = 'Just now',
  expiresInMinutes,
  firstSigner,
  requiresSecondSigner = true,
  onApprove,
  onReject,
  diffSummary,
}: ApprovalCardProps) {
  const isPending = status === 'pending';

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0E273A]/60 backdrop-blur-md p-4 text-xs text-gray-200 space-y-3 shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-sm text-white">{title}</span>
            <ScopeBadge scope={scope} />
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                status === 'approved'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : status === 'rejected'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
              }`}
            >
              {status}
            </span>
          </div>
          <div className="text-gray-400 text-[11px]">
            Requested by <strong className="text-gray-200">{requesterName}</strong> ({requesterRole}) for{' '}
            <strong className="text-white">{targetOrg}</strong> · {timestamp}
          </div>
        </div>

        {expiresInMinutes && isPending && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0">
            <Clock className="w-3 h-3" />
            <span>{expiresInMinutes}m SLA</span>
          </div>
        )}
      </div>

      {/* Justification quote */}
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-gray-300 text-xs italic">
        "{reason}"
      </div>

      {/* Diff Preview if present */}
      {diffSummary && diffSummary.length > 0 && (
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1 font-mono text-[11px]">
          {diffSummary.map((d, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-gray-400">{d.field}:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-red-400 line-through">{String(d.before)}</span>
                <span className="text-gray-500">→</span>
                <span className="text-emerald-400 font-bold">{String(d.after)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two-Person Signer Status Badge */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <UserCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>
            {requiresSecondSigner ? (
              firstSigner ? (
                <>
                  1st Signer: <strong className="text-emerald-400">{firstSigner}</strong> · Awaiting 2nd
                  Signer
                </>
              ) : (
                <>Two-Person Approval Required (Clinical Lead + DPO / Governance)</>
              )
            ) : (
              <>Single Signer Approval</>
            )}
          </span>
        </div>

        {/* Action buttons if pending */}
        {isPending && onApprove && onReject && (
          <div className="flex items-center gap-2">
            <button
              onClick={onReject}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-300 text-xs font-semibold transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Reject</span>
            </button>
            <button
              onClick={onApprove}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-black text-xs font-bold transition-all shadow-md"
            >
              <Check className="w-3 h-3 text-black" />
              <span>Approve & Sign</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
