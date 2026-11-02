import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { PasswordStrengthMeter } from '../../components/common/PasswordStrengthMeter';
import { Eye, EyeOff, CheckCircle2, ArrowRight, ShieldCheck, Mail } from 'lucide-react';

export function SignUpPage() {
  const [formData, setFormData] = useState({
    accountName: '',
    accountAlias: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors([]);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.signup({
        accountName: formData.accountName,
        accountAlias: formData.accountAlias ? formData.accountAlias.toLowerCase().trim() : undefined,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (res.success) {
        setSuccessResult(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
      if (err.data?.errors) {
        setFieldErrors(err.data.errors);
      }
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
            Create an AWS Account
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Sign up as Root user with full administrative permissions.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-aws-darkBorder rounded-lg p-6 sm:p-8 shadow-xl">
          {successResult ? (
            <div className="space-y-6 text-center animate-in fade-in duration-200">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  Account Created Successfully!
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Your organization account ID has been allocated:
                </p>
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded font-mono font-bold text-sm text-aws-blue dark:text-cyan-400 border border-gray-200 dark:border-gray-700 select-all">
                  Account ID: {successResult.accountId}
                </div>
              </div>

              {/* Simulated Email Verification Box */}
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-left text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-200">
                  <Mail className="w-4 h-4 text-aws-blue" />
                  <span>Verify Email Address</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  A verification link was dispatched to <strong>{successResult.email}</strong>.
                </p>
                <Link
                  to={`/verify-email?token=${successResult.verificationToken}`}
                  className="inline-flex items-center gap-1.5 text-aws-blue hover:underline font-bold text-xs pt-1"
                >
                  <span>Simulate Clicking Verification Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="pt-2">
                <Link
                  to="/signin"
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded font-bold text-xs bg-aws-orange hover:bg-aws-orangeHover text-black shadow-sm transition-all"
                >
                  Proceed to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 dark:text-red-400 font-medium">
                  {error}
                  {fieldErrors.length > 0 && (
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
                      {fieldErrors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Organization Account Name */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  AWS Account / Organization Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp Cloud"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange text-xs"
                />
              </div>

              {/* Account Alias (Optional) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Account Alias (Optional)
                  </label>
                  <span className="text-[10px] text-gray-400">For IAM user sign-in URLs</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. acme-corp"
                  value={formData.accountAlias}
                  onChange={(e) => setFormData({ ...formData, accountAlias: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange text-xs font-mono"
                />
              </div>

              {/* Root Email */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Root User Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="owner@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange text-xs"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Root Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 12 characters"
                    className="w-full p-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Live Password Strength Meter */}
                <PasswordStrengthMeter password={formData.password} />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-2.5 px-4 bg-aws-orange hover:bg-aws-orangeHover text-black font-extrabold rounded shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Create AWS Account'}
              </button>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
                <span className="text-gray-500">Already have an account? </span>
                <Link to="/signin" className="text-aws-blue hover:underline font-bold">
                  Sign in
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
