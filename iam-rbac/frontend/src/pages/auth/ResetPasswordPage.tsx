import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { PasswordStrengthMeter } from '../../components/common/PasswordStrengthMeter';
import { Eye, EyeOff, CheckCircle2, LockKeyhole } from 'lucide-react';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.resetPassword({
        token: token.trim(),
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Token may be invalid or expired.');
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
            Set New Password
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-aws-darkBorder rounded-lg p-6 sm:p-8 shadow-xl text-xs">
          {success ? (
            <div className="text-center space-y-4 py-4 animate-in fade-in duration-200">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Password Successfully Reset
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your credentials have been updated securely. Any previous sessions have been invalidated.
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => navigate('/signin')}
                  className="w-full py-2.5 px-4 bg-aws-orange hover:bg-aws-orangeHover text-black font-extrabold rounded shadow-sm"
                >
                  Sign in with New Password
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 p-2.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded text-gray-700 dark:text-gray-300">
                <LockKeyhole className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span>Enter your verification token and your new strong password.</span>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 dark:text-red-400 font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste reset token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white font-mono text-xs focus:outline-none focus:border-aws-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 12 chars (Upper, lower, number, symbol)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthMeter password={newPassword} />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !token || !newPassword || !confirmPassword}
                className="w-full py-2.5 px-4 bg-aws-orange hover:bg-aws-orangeHover text-black font-extrabold rounded shadow-sm transition-colors cursor-pointer disabled:opacity-50 text-xs"
              >
                {loading ? 'Updating Password...' : 'Reset Password'}
              </button>

              <div className="text-center pt-2">
                <Link to="/signin" className="text-aws-blue dark:text-cyan-400 hover:underline font-semibold">
                  Back to Sign In
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
