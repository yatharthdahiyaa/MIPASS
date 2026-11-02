import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { CheckCircle2, AlertCircle, Mail, ArrowRight } from 'lucide-react';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const executeVerification = async (tok: string) => {
    if (!tok.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await authApi.verifyEmail(tok.trim());
      if (res.success) {
        setVerified(true);
      }
    } catch (err: any) {
      setError(err.message || 'Verification token is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenFromUrl) {
      executeVerification(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeVerification(token);
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    setResendStatus(null);

    try {
      // Re-trigger sign-in step 1 or forgot email
      await authApi.forgotPassword(resendEmail);
      setResendStatus('If an account exists with this email, a new link has been dispatched.');
    } catch (err: any) {
      setResendStatus('If an account exists with this email, a new link has been dispatched.');
    } finally {
      setResending(false);
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
            Email Verification
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-aws-darkBorder rounded-lg p-6 sm:p-8 shadow-xl text-xs">
          {loading ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-10 h-10 border-4 border-aws-orange border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-semibold text-gray-600 dark:text-gray-300">
                Verifying your email token with AWS Directory...
              </p>
            </div>
          ) : verified ? (
            <div className="text-center space-y-4 py-4 animate-in fade-in duration-200">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Email Address Verified!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your AWS account is now active. You have full root credentials to access the AWS Management Console.
              </p>
              <div className="pt-4">
                <Link
                  to="/signin"
                  className="w-full py-3 px-4 bg-aws-orange hover:bg-aws-orangeHover text-black font-extrabold rounded shadow-sm inline-flex items-center justify-center gap-2 transition-colors"
                >
                  Sign in to AWS Console
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 dark:text-red-400 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Verification Token
                  </label>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Paste the 64-character token provided in your verification link.
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 7f9a2b8c..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white font-mono text-xs focus:outline-none focus:border-aws-orange"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!token.trim()}
                  className="w-full py-2.5 px-4 bg-aws-orange hover:bg-aws-orangeHover text-black font-extrabold rounded shadow-sm transition-colors cursor-pointer disabled:opacity-50 text-xs"
                >
                  Verify Token
                </button>
              </form>

              {/* Resend Section */}
              <div className="pt-5 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2 font-bold text-gray-700 dark:text-gray-300">
                  <Mail className="w-4 h-4 text-aws-blue dark:text-cyan-400" />
                  <span>Didn't receive an email or token expired?</span>
                </div>
                <form onSubmit={handleResend} className="space-y-2">
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white text-xs focus:outline-none focus:border-aws-orange"
                  />
                  <button
                    type="submit"
                    disabled={resending || !resendEmail}
                    className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded text-xs transition-colors cursor-pointer"
                  >
                    {resending ? 'Sending...' : 'Resend Verification Token'}
                  </button>
                  {resendStatus && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {resendStatus}
                    </p>
                  )}
                </form>
              </div>

              <div className="text-center pt-2">
                <Link to="/signin" className="text-aws-blue dark:text-cyan-400 hover:underline font-semibold">
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="text-center text-[11px] text-gray-500 mt-6">
        © 2026, Amazon Web Services, Inc. or its affiliates. All rights reserved.
      </footer>
    </div>
  );
}
