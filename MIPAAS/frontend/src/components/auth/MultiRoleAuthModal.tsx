'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRBAC } from '@/context/RBACContext';
import {
  X,
  Heart,
  Stethoscope,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Phone,
  Calendar,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface MultiRoleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: 'patient' | 'doctor' | 'admin';
  initialMode?: 'login' | 'register';
}

export default function MultiRoleAuthModal({
  isOpen,
  onClose,
  initialRole = 'patient',
  initialMode = 'login',
}: MultiRoleAuthModalProps) {
  const router = useRouter();
  const { switchPersona, currentUser } = useRBAC();

  const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor' | 'admin'>(initialRole);
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Patient registration fields
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    password: '',
    confirmPassword: '',
    consent: false,
  });

  if (!isOpen) return null;

  const handleRoleSelect = (role: 'patient' | 'doctor' | 'admin') => {
    setSelectedRole(role);
    setError(null);
    setSuccessMsg(null);
    // Only patient has public registration
    if (role !== 'patient' && authMode === 'register') {
      setAuthMode('login');
    }
    // Prefill demo credentials for easy reviewer evaluation
    if (role === 'patient') {
      setEmail('alex.taylor@carenest.health');
      setPassword('Patient#2026');
    } else if (role === 'doctor') {
      setEmail('elena.vance@mipaas.health');
      setPassword('Doctor#2026');
    } else if (role === 'admin') {
      setEmail('arthur.davis@mipaas.health');
      setPassword('Adm!nS3cur3#2026');
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      if (selectedRole === 'patient') {
        switchPersona('pat-01');
        setSuccessMsg('Authenticated as Alex Taylor. Redirecting to Patient Portal...');
        setTimeout(() => {
          onClose();
          router.push('/emr');
        }, 1000);
      } else if (selectedRole === 'doctor') {
        switchPersona('doc-01');
        setSuccessMsg('Authenticated as Dr. Elena Vance, MD. Redirecting to Doctor Portal...');
        setTimeout(() => {
          onClose();
          router.push('/doctor');
        }, 1000);
      } else if (selectedRole === 'admin') {
        switchPersona('admin-01');
        setSuccessMsg('Authenticated as Arthur Davis, CISSP. Redirecting to Admin Console...');
        setTimeout(() => {
          onClose();
          router.push('/admin');
        }, 1000);
      }
    }, 600);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!registerForm.fullName.trim()) {
      setError('Please enter your full legal name.');
      return;
    }
    if (!registerForm.email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (registerForm.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!registerForm.consent) {
      setError('You must agree to the HIPAA Privacy Policy and Terms of Care.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      switchPersona('pat-01');
      setSuccessMsg(`Account created for ${registerForm.fullName}! Redirecting to your personal health portal...`);
      setTimeout(() => {
        onClose();
        router.push('/emr');
      }, 1200);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#051322] border border-[#16d9f5]/35 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-[0_20px_60px_rgba(2,11,20,0.9)] relative text-white">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#0b2844] border border-[#16d9f5]/40 text-[#16d9f5] mx-auto flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(22,217,245,0.3)]">
            {selectedRole === 'patient' && <Heart className="w-6 h-6 fill-[#16d9f5]/20" />}
            {selectedRole === 'doctor' && <Stethoscope className="w-6 h-6" />}
            {selectedRole === 'admin' && <ShieldCheck className="w-6 h-6" />}
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {authMode === 'register' ? 'Create Patient Account' : 'MiPAAS Healthcare Access'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {authMode === 'register'
              ? 'Enroll in your personal digital health portal'
              : 'Select your clinical role to sign in to your authorized workspace'}
          </p>
        </div>

        {/* 3 Role Selection Cards */}
        {authMode === 'login' && (
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <button
              type="button"
              onClick={() => handleRoleSelect('patient')}
              className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                selectedRole === 'patient'
                  ? 'bg-[#16d9f5]/15 border-[#16d9f5] text-white shadow-[0_0_15px_rgba(22,217,245,0.3)] font-bold'
                  : 'bg-[#081f36]/60 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <Heart className={`w-5 h-5 ${selectedRole === 'patient' ? 'text-[#16d9f5]' : 'text-slate-400'}`} />
              <span className="text-xs">Patient</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('doctor')}
              className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                selectedRole === 'doctor'
                  ? 'bg-[#16d9f5]/15 border-[#16d9f5] text-white shadow-[0_0_15px_rgba(22,217,245,0.3)] font-bold'
                  : 'bg-[#081f36]/60 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <Stethoscope className={`w-5 h-5 ${selectedRole === 'doctor' ? 'text-[#16d9f5]' : 'text-slate-400'}`} />
              <span className="text-xs">Doctor</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('admin')}
              className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                selectedRole === 'admin'
                  ? 'bg-[#16d9f5]/15 border-[#16d9f5] text-white shadow-[0_0_15px_rgba(22,217,245,0.3)] font-bold'
                  : 'bg-[#081f36]/60 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <ShieldCheck className={`w-5 h-5 ${selectedRole === 'admin' ? 'text-[#16d9f5]' : 'text-slate-400'}`} />
              <span className="text-xs">Admin</span>
            </button>
          </div>
        )}

        {/* Feedback Alerts */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {authMode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                {selectedRole === 'patient'
                  ? 'Patient Email or MRN'
                  : selectedRole === 'doctor'
                  ? 'Doctor Email or NPI'
                  : 'Administrator Username'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    selectedRole === 'patient'
                      ? 'alex.taylor@carenest.health'
                      : selectedRole === 'doctor'
                      ? 'elena.vance@mipaas.health'
                      : 'arthur.davis@mipaas.health'
                  }
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#071d33] border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#16d9f5] focus:ring-1 focus:ring-[#16d9f5]"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-slate-300 font-medium">Password</label>
                <button
                  type="button"
                  onClick={() => alert('Password reset link sent to your registered email.')}
                  className="text-xs text-[#16d9f5] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#071d33] border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#16d9f5] focus:ring-1 focus:ring-[#16d9f5]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Role Notice */}
            {selectedRole === 'doctor' && (
              <p className="text-[11px] text-slate-400 leading-relaxed bg-[#0b2742]/50 p-2.5 rounded-xl border border-white/5">
                🔒 Doctor workstation is restricted to verified healthcare professionals (Dr. Elena Vance, MD).
              </p>
            )}
            {selectedRole === 'admin' && (
              <p className="text-[11px] text-slate-400 leading-relaxed bg-[#0b2742]/50 p-2.5 rounded-xl border border-white/5">
                🛡️ Administrative accounts are provisioned by enterprise IT. No public registration available.
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#16d9f5] to-[#26e6cf] hover:brightness-110 text-[#020b14] font-black text-sm shadow-[0_0_20px_rgba(22,217,245,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In as {selectedRole === 'patient' ? 'Patient' : selectedRole === 'doctor' ? 'Doctor' : 'Administrator'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Patient Registration Toggle */}
            {selectedRole === 'patient' && (
              <div className="pt-2 text-center text-xs text-slate-400">
                New patient?{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className="font-bold text-[#16d9f5] hover:underline cursor-pointer"
                >
                  Create a Patient Account
                </button>
              </div>
            )}
          </form>
        ) : (
          /* PATIENT REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs sm:text-sm">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Full Legal Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={registerForm.fullName}
                  onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                  placeholder="e.g. Alex Taylor"
                  required
                  className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#071d33] border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#16d9f5]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  placeholder="name@carenest.health"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#071d33] border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#16d9f5]"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={registerForm.phone}
                  onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                  placeholder="(555) 014-2901"
                  className="w-full px-3 py-2 rounded-xl bg-[#071d33] border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#16d9f5]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  placeholder="Min 8 characters"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#071d33] border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#16d9f5]"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                  placeholder="Confirm password"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#071d33] border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#16d9f5]"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  checked={registerForm.consent}
                  onChange={(e) => setRegisterForm({ ...registerForm, consent: e.target.checked })}
                  className="mt-0.5 rounded text-[#16d9f5] focus:ring-[#16d9f5]"
                />
                <span>
                  I consent to the HIPAA privacy terms and authorize creation of my personal digital health portal.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#16d9f5] to-[#26e6cf] hover:brightness-110 text-[#020b14] font-black text-sm shadow-[0_0_20px_rgba(22,217,245,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? <span>Creating Account...</span> : <span>Create Patient Account</span>}
            </button>

            <div className="text-center text-xs text-slate-400 pt-1">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="font-bold text-[#16d9f5] hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
