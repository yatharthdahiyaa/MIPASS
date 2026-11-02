import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { ArrowLeft, CheckCircle2, ShieldQuestion } from 'lucide-react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      // Return success UX state anyway to prevent account enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-aws-lightbg dark:bg-aws-darkBg flex flex-col justify-between p-4 py-8 text-aws-text dark:text-gray-100">
      <div className="max-w-md w-full mx-auto my-auto">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded bg-gradient-to-br from-aws-orange to-aws-orangeHover flex items-center justify-center font-black text-black text-sm shadow">
              M
            </div>
            <span className="font-black text-2xl tracking-tight text-aws-navy dark:text-white">
              AWS
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Reset Password
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-aws-darkBorder rounded-lg p-6 sm:p-8 shadow-xl text-xs">
          {submitted ? (
            <div className="space-y-4 text-center py-2 animate-in fade-in duration-150">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Password Reset Dispatched
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                If an account exists for <span className="font-semibold">{email}</span>, password reset instructions and a secure time-limited token (valid for 1 hour) have been sent.
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded text-amber-900 dark:text-amber-200 text-left">
                <p className="font-bold text-[11px] mb-1">Development Notice:</p>
                <p className="text-[11px]">
                  In this local sandbox environment, tokens are stored in the database. You can proceed to the reset screen directly.
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  to="/reset-password"
                  className="w-full py-2.5 px-4 bg-aws-orange hover:bg-aws-orangeHover text-black font-extrabold rounded text-center"
                >
                  Enter Reset Token
                </Link>
                <Link
                  to="/signin"
                  className="w-full py-2 text-aws-blue dark:text-cyan-400 hover:underline font-semibold text-center"
                >
                  Return to Sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
                <ShieldQuestion className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                <p className="text-gray-600 dark:text-gray-300">
                  Enter your AWS Root user email address. We'll issue a verification token to reset your password.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 dark:text-red-400 font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Root user email address
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white text-xs focus:outline-none focus:border-aws-orange"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 px-4 bg-aws-orange hover:bg-aws-orangeHover text-black font-extrabold rounded shadow-sm transition-colors cursor-pointer disabled:opacity-50 text-xs"
              >
                {loading ? 'Sending Instructions...' : 'Send Reset Instructions'}
              </button>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 text-center">
                <Link
                  to="/signin"
                  className="text-aws-blue dark:text-cyan-400 hover:underline flex items-center justify-center gap-1 font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      <footer className="text-center text-[11px] text-gray-500 mt-6">
        © 2026, Amazon Web Services, Inc. or its affiliates. All rights reserved.
      </footer>
    </div>
  );
}
