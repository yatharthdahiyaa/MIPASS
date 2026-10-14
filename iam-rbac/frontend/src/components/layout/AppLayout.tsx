import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Modal } from '../common/Modal';
import { authApi } from '../../api/auth';
import { ShieldCheck, Copy, Check } from 'lucide-react';

export function AppLayout() {
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [mfaData, setMfaData] = useState<{ secret: string; qrCodeUrl: string; backupCodes: string[] } | null>(null);
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [loadingMfa, setLoadingMfa] = useState(false);

  const handleOpenMfa = async () => {
    setIsMfaModalOpen(true);
    setLoadingMfa(true);
    setMfaError('');
    setMfaSuccess(false);

    try {
      const res = await authApi.mfaSetup();
      if (res.success && res.data) {
        setMfaData(res.data);
      }
    } catch (err: any) {
      setMfaError(err.message || 'Failed to initialize MFA.');
    } finally {
      setLoadingMfa(false);
    }
  };

  const handleEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError('');

    try {
      const res = await authApi.mfaEnable(mfaVerificationCode);
      if (res.success) {
        setMfaSuccess(true);
        setTimeout(() => {
          setIsMfaModalOpen(false);
        }, 1500);
      }
    } catch (err: any) {
      setMfaError(err.message || 'Invalid verification code.');
    }
  };

  const handleCopyBackupCodes = () => {
    if (mfaData?.backupCodes) {
      navigator.clipboard.writeText(mfaData.backupCodes.join('\n'));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-aws-lightbg dark:bg-aws-darkBg text-aws-text dark:text-gray-100">
      <Navbar onOpenMfaModal={handleOpenMfa} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Multi-Factor Authentication Setup Modal */}
      <Modal
        isOpen={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
        title="Assign MFA Device (Google Authenticator / Authy)"
        maxWidth="lg"
      >
        {loadingMfa ? (
          <div className="py-12 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-aws-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : mfaSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white">
              MFA Successfully Activated!
            </h4>
            <p className="text-xs text-gray-500">
              Your account is now protected with two-factor authentication.
            </p>
          </div>
        ) : (
          mfaData && (
            <div className="space-y-5 text-xs">
              <p className="text-gray-600 dark:text-gray-400">
                Scan the QR code below using your mobile authenticator app (Google Authenticator, Microsoft Authenticator, or 1Password).
              </p>

              {/* QR Code and Secret */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <img
                  src={mfaData.qrCodeUrl}
                  alt="MFA QR Code"
                  className="w-36 h-36 bg-white p-2 rounded border border-gray-200 shadow-sm"
                />
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-gray-500 block uppercase">
                    Manual Entry Key:
                  </span>
                  <code className="text-xs font-mono font-bold text-aws-blue dark:text-cyan-400 bg-white dark:bg-black px-2 py-1 rounded border border-gray-200 dark:border-gray-700 block select-all">
                    {mfaData.secret}
                  </code>
                  <p className="text-[11px] text-gray-500">
                    If camera scanning is unavailable, type this key into your authenticator.
                  </p>
                </div>
              </div>

              {/* 8 One-Time Backup Codes */}
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-amber-900 dark:text-amber-200">
                    One-Time Backup Emergency Codes (Save securely)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyBackupCodes}
                    className="text-xs text-aws-blue hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodes ? 'Copied' : 'Copy All'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-gray-800 dark:text-gray-300">
                  {mfaData.backupCodes.map((c, i) => (
                    <div key={i} className="bg-white dark:bg-black/50 p-1.5 rounded text-center border border-amber-100 dark:border-amber-900/50">
                      {c}
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification Form */}
              <form onSubmit={handleEnableMfa} className="space-y-3 pt-2">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Enter 6-digit Code from Authenticator:
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={mfaVerificationCode}
                    onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center text-lg font-mono tracking-widest p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
                    required
                  />
                </div>

                {mfaError && (
                  <div className="text-red-600 text-xs font-semibold">{mfaError}</div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsMfaModalOpen(false)}
                    className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded bg-aws-orange hover:bg-aws-orangeHover text-black font-extrabold shadow-sm cursor-pointer"
                  >
                    Verify &amp; Activate MFA
                  </button>
                </div>
              </form>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
