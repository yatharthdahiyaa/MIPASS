'use client';

import React, { useState } from 'react';
import { AlertTriangle, Key, Lock, ShieldAlert, X } from 'lucide-react';

interface SensitiveActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  actionLabel?: string;
  impactSummary: string; // e.g. "Affects 4 sites, 37 active clinicians, and 12 live DICOM PACS nodes"
  requiresConfirmationWord?: string; // e.g. "CONFIRM_ERASURE" or "OVERRIDE_THRESHOLD"
  isDestructive?: boolean;
}

export default function SensitiveActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  actionLabel = 'Authorize Action',
  impactSummary,
  requiresConfirmationWord,
  isDestructive = true,
}: SensitiveActionModalProps) {
  const [password, setPassword] = useState('');
  const [typedReason, setTypedReason] = useState('');
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please provide your admin session password.');
      return;
    }
    if (typedReason.trim().length < 10) {
      setError('Please provide a descriptive clinical/operational justification (min 10 characters).');
      return;
    }
    if (requiresConfirmationWord && typedConfirmation.trim() !== requiresConfirmationWord) {
      setError(`Please type the exact phrase "${requiresConfirmationWord}" to proceed.`);
      return;
    }

    onConfirm(typedReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-3xl border border-red-500/40 p-6 shadow-2xl text-white relative"
        style={{ backgroundColor: '#0A1823' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">{title}</h3>
              <p className="text-xs text-red-300 font-semibold tracking-wide uppercase">
                High-Risk Tier 3 Administrative Action
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Impact Summary Card */}
        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs mb-4">
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Blast Radius & Impact Summary:</span>
          </div>
          <p className="leading-relaxed text-amber-100/90">{impactSummary}</p>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Re-authentication Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Admin Re-Authentication (Session Password) *
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter current sign-in password..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Clinical Justification */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Mandatory Operational / Clinical Reason *
            </label>
            <textarea
              required
              rows={2}
              value={typedReason}
              onChange={(e) => {
                setTypedReason(e.target.value);
                setError('');
              }}
              placeholder="Provide exact justification for the immutable audit log..."
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Type Confirmation Phrase if required */}
          {requiresConfirmationWord && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Type <span className="font-mono text-red-400">{requiresConfirmationWord}</span> to confirm *
              </label>
              <input
                type="text"
                required
                value={typedConfirmation}
                onChange={(e) => {
                  setTypedConfirmation(e.target.value);
                  setError('');
                }}
                placeholder={`Type "${requiresConfirmationWord}"...`}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white font-mono placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
                isDestructive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-teal-500 hover:bg-teal-600 text-black'
              }`}
            >
              {actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
