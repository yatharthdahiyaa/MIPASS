'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface AdminNoticeProps {
  message: string | null;
  onDismiss: () => void;
}

export default function AdminNotice({ message, onDismiss }: AdminNoticeProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-2.5 rounded-2xl border border-teal-500/40 bg-[#0A1823] px-4 py-3 text-xs text-white shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-gray-400 transition-colors hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
