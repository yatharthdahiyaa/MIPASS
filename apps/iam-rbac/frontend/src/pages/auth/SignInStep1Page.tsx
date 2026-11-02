import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { UserType } from '../../types/auth';

export function SignInStep1Page() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<UserType>('root');
  const [email, setEmail] = useState('');
  const [accountIdOrAlias, setAccountIdOrAlias] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authApi.signinStep1({
        userType,
        email: userType === 'root' ? email : undefined,
        accountIdOrAlias: userType === 'iam' ? accountIdOrAlias : undefined,
        username: userType === 'iam' ? username : undefined,
      });

      if (res.success) {
        navigate('/signin/step2', {
          state: {
            userType,
            email,
            accountIdOrAlias,
            username,
            accountName: res.data.accountName,
            requiresMfa: res.data.requiresMfa,
          },
        });
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect credentials. Please verify your information.');
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
            Sign in
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-aws-darkBorder rounded-lg p-6 sm:p-8 shadow-xl">
          <form onSubmit={handleNext} className="space-y-6 text-xs">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-red-600 dark:text-red-400 font-medium">
                {error}
              </div>
            )}

            {/* Radio Selection: Root vs IAM */}
            <div className="space-y-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded border cursor-pointer transition-all ${
                  userType === 'root'
                    ? 'border-aws-orange bg-amber-50/40 dark:bg-amber-950/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <input
                  type="radio"
                  name="userType"
                  value="root"
                  checked={userType === 'root'}
                  onChange={() => setUserType('root')}
                  className="mt-0.5 text-aws-orange focus:ring-aws-orange"
                />
                <div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white">
                    Root user
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Account owner that performs tasks requiring unrestricted access.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded border cursor-pointer transition-all ${
                  userType === 'iam'
                    ? 'border-aws-orange bg-amber-50/40 dark:bg-amber-950/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <input
                  type="radio"
                  name="userType"
                  value="iam"
                  checked={userType === 'iam'}
                  onChange={() => setUserType('iam')}
                  className="mt-0.5 text-aws-orange focus:ring-aws-orange"
                />
                <div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white">
                    IAM user
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    An IAM user within an account that performs daily operational tasks.
                  </div>
                </div>
              </label>
            </div>

            {/* Root User Input */}
            {userType === 'root' && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Root user email address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange text-xs"
                />
              </div>
            )}

            {/* IAM User Inputs */}
            {userType === 'iam' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Account ID (12 digits) or account alias
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="123456789012 or my-company"
                    value={accountIdOrAlias}
                    onChange={(e) => setAccountIdOrAlias(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    IAM user name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="alice.dev"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-black/40 text-gray-900 dark:text-white focus:outline-none focus:border-aws-orange text-xs"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-aws-orange hover:bg-aws-orangeHover text-black font-extrabold rounded shadow-sm transition-colors cursor-pointer disabled:opacity-50 text-xs"
            >
              {loading ? 'Verifying...' : 'Next'}
            </button>

            {/* MiPAAS Clinical & IAM Fast Login Options */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                MiPAAS Clinical Quick Sign-in
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUserType('root');
                    setEmail('root@aws-example.com');
                  }}
                  className="p-2 text-left rounded border border-gray-200 dark:border-gray-700 hover:border-aws-orange hover:bg-amber-500/5 text-[11px] transition-all cursor-pointer"
                >
                  <div className="font-bold text-aws-orange">Root Admin</div>
                  <div className="text-[10px] text-gray-400">root@aws-example.com</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserType('iam');
                    setAccountIdOrAlias('aws-demo');
                    setUsername('elena.vance');
                  }}
                  className="p-2 text-left rounded border border-gray-200 dark:border-gray-700 hover:border-[#00DCCE] hover:bg-teal-500/5 text-[11px] transition-all cursor-pointer"
                >
                  <div className="font-bold text-teal-500 dark:text-[#00DCCE]">Dr. Elena Vance</div>
                  <div className="text-[10px] text-gray-400">Radiologist</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserType('iam');
                    setAccountIdOrAlias('aws-demo');
                    setUsername('marcus.chen');
                  }}
                  className="p-2 text-left rounded border border-gray-200 dark:border-gray-700 hover:border-emerald-500 hover:bg-emerald-500/5 text-[11px] transition-all cursor-pointer"
                >
                  <div className="font-bold text-emerald-500 dark:text-emerald-400">Marcus Chen</div>
                  <div className="text-[10px] text-gray-400">CT Technician</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserType('iam');
                    setAccountIdOrAlias('aws-demo');
                    setUsername('arthur.davis');
                  }}
                  className="p-2 text-left rounded border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-500/5 text-[11px] transition-all cursor-pointer"
                >
                  <div className="font-bold text-indigo-500 dark:text-indigo-400">Arthur Davis</div>
                  <div className="text-[10px] text-gray-400">Clinical Lead</div>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2 text-center">
              <div>
                <span className="text-gray-500">New to AWS? </span>
                <Link to="/signup" className="text-aws-blue hover:underline font-bold">
                  Create a new AWS account
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>

      <footer className="text-center text-[11px] text-gray-500 mt-6">
        © 2026, Amazon Web Services, Inc. or its affiliates. All rights reserved.
      </footer>
    </div>
  );
}
