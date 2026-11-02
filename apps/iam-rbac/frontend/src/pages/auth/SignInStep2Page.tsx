import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, ShieldAlert, ArrowLeft } from 'lucide-react';

interface Step2LocationState {
  userType: 'root' | 'iam';
  email?: string;
  accountIdOrAlias?: string;
  username?: string;
  accountName?: string;
  requiresMfa?: boolean;
}

export function SignInStep2Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser } = useAuth();
  const state = (location.state as Step2LocationState) || {};

  const userType = state.userType || 'root';
  const email = state.email || '';
  const accountIdOrAlias = state.accountIdOrAlias || '';
  const username = state.username || '';
  const accountName = state.accountName || 'AWS Account';

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // If someone lands directly on step2 without step1 state, redirect to step1
  if (!email && (!accountIdOrAlias || !username)) {
    return (
      <div className="min-h-screen bg-aws-lightbg dark:bg-aws-darkBg flex items-center justify-center p-4">
        <div className="bg-white dark:bg-aws-darkCard p-6 rounded-lg border border-gray-200 dark:border-gray-800 text-center max-w-sm">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Session expired or identifier missing. Please start from Step 1.
          </p>
          <Link
            to="/signin"
            className="inline-block py-2 px-4 bg-aws-orange hover:bg-aws-orangeHover text-black font-bold rounded text-xs"
          >
            Go to Sign-in
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLocked(false);
    setLoading(true);

    try {
      const res = await authApi.signinStep2({
        userType,
        email: userType === 'root' ? email : undefined,
        accountIdOrAlias: userType === 'iam' ? accountIdOrAlias : undefined,
        username: userType === 'iam' ? username : undefined,
        password,
        rememberDevice,
      });

      if (res.success) {
        if (res.requiresMfa) {
          navigate('/signin/mfa', {
            state: {
              mfaSessionToken: res.mfaSessionToken,
              userType,
              identifier: userType === 'root' ? email : username,
            },
          });
        } else if (res.data?.user) {
          // Flush the auth-state update synchronously so the dashboard and layout
          // (sidebar, navbar, role/permission gating) render with the new user.
          flushSync(() => {
            loginUser(res.data.user);
          });
          try {
            localStorage.setItem('mipaas_iam_user', JSON.stringify(res.data.user));
          } catch {
            // ignore
          }
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (err: any) {
      if (err.error === 'AccountLocked' || err.status === 423) {
        setIsLocked(true);
      }
      setError(err.message || 'Incorrect credentials. Please verify your information and try again.');
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
            Enter password
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-aws-darkBorder rounded-lg p-6 sm:p-8 shadow-xl">
          {/* Identity confirmation badge */}
          <div className="mb-5 p-3 rounded bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 flex items-center justify-between">
            <div className="truncate">
              <span className="text-[11px] font-semibold text-gray-500 block uppercase tracking-wider">
                {userType === 'root' ? 'Root user' : `IAM user @ ${accountName}`}
              </span>
              <span className="text-xs font-bold text-gray-900 dark:text-white truncate block">
                {userType === 'root' ? email : username}
              </span>
            </div>
            <Link
              to="/signin"
              className="text-xs text-aws-blue dark:text-cyan-400 hover:underline flex items-center gap-1 font-semibold whitespace-nowrap pl-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Edit
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            {error && (
              <div
                className={`p-3 rounded border flex items-start gap-2.5 font-medium ${
                  isLocked
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400'
                }`}
              >
                {isLocked && <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
                <div>{error}</div>
              </div>
            )}

            {/* Password input with toggle */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-bold text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-aws-blue dark:text-cyan-400 hover:underline text-[11px] font-semibold"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Quick Fill Demo Password */}
              <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1">
                <span>Clinical Demo Password:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (userType === 'root') setPassword('AdminRoot@123456');
                    else if (username === 'elena.vance') setPassword('Rad!0l0gist#2026');
                    else if (username === 'marcus.chen') setPassword('T3chCT$can#2026');
                    else if (username === 'sarah.lin') setPassword('R3s34rch!AI#2026');
                    else if (username === 'arthur.davis') setPassword('Adm!nS3cur3#2026');
                    else if (username === 'a.pendelton') setPassword('Aud!tC0mply#2026');
                    else setPassword('DeveloperPass#2026!');
                  }}
                  className="text-aws-blue dark:text-cyan-400 hover:underline font-bold cursor-pointer"
                >
                  ⚡ Autofill Password
                </button>
              </div>
            </div>

            {/* Remember device checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="rounded border-gray-300 text-aws-orange focus:ring-aws-orange"
              />
              <span className="text-gray-700 dark:text-gray-300">
                Remember this device for 30 days
              </span>
            </label>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 px-4 bg-aws-orange hover:bg-aws-orangeHover text-black font-extrabold rounded shadow-sm transition-colors cursor-pointer disabled:opacity-50 text-xs"
            >
              {loading ? 'Authenticating...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <Link to="/signin" className="text-aws-blue dark:text-cyan-400 hover:underline font-semibold text-xs">
              Sign in with a different account
            </Link>
          </div>
        </div>
      </div>

      <footer className="text-center text-[11px] text-gray-500 mt-6">
        © 2026, Amazon Web Services, Inc. or its affiliates. All rights reserved.
      </footer>
    </div>
  );
}
