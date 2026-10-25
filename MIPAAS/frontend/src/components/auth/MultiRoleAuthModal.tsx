'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRBAC } from '@/context/RBACContext';
import { UserProfile, ROLE_DEFINITIONS } from '@/types/rbac';
import { clinicalApiService } from '@/services/clinicalApiService';
import { iamAuthService } from '@/services/iamAuthService';
import { DEMO_AUTH_ENABLED } from '@/lib/demoMode';
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
  const { switchPersona, loginWithCustomProfile, loginWithIAM, currentUser } = useRBAC();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRoleSelect = (role: 'patient' | 'doctor' | 'admin') => {
    setSelectedRole(role);
    setError(null);
    setSuccessMsg(null);
    // Only patient has public registration
    if (role !== 'patient' && authMode === 'register') {
      setAuthMode('login');
    }
    // Clear inputs on role change
    setEmail('');
    setPassword('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!DEMO_AUTH_ENABLED) {
        const res = await iamAuthService.loginRole({
          role: selectedRole,
          identifier: email,
          password,
        });
        if (!res.success || !res.data?.user) {
          throw new Error(res.message || 'Incorrect credentials for the selected role.');
        }
        loginWithIAM(res.data.user);
        const mappedRole = iamAuthService.mapIamUserToClinicalProfile(res.data.user).role;
        const targetPath = mappedRole === 'patient' ? '/patient' : mappedRole === 'doctor' || mappedRole === 'radiologist' ? '/doctor' : '/admin';
        setSuccessMsg(`Signed in as ${res.data.user.username}. Redirecting...`);
        setTimeout(() => {
          setIsLoading(false);
          onClose();
          router.push(targetPath);
        }, 800);
        return;
      }

      const lowerEmail = email.toLowerCase().trim();

      if (selectedRole === 'patient') {
        if (lowerEmail.includes('alex.taylor')) {
          switchPersona('pat-01');
          setSuccessMsg('Authenticated as Alex Taylor. Redirecting to Patient Portal...');
        } else {
          // Check backend patients or derive clean display name
          const pts = await clinicalApiService.getPatients().catch(() => []);
          const matchedPt = pts.find((p) => p.email && p.email.toLowerCase() === lowerEmail);
          const rawName = matchedPt
            ? matchedPt.name
            : lowerEmail
                .split('@')[0]
                .split('.')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
          const displayName = rawName || 'Patient User';

          const userProfile: UserProfile = {
            id: matchedPt?.id || `pat-${Date.now().toString(36)}`,
            name: displayName,
            email: lowerEmail,
            role: 'patient',
            roleTitle: 'Registered Patient',
            department: 'Primary Care',
            organization: 'CareNest Health System',
            permissions: ROLE_DEFINITIONS.patient.permissions,
          };

          // If no chart exists yet in backend, automatically create one for them
          if (!matchedPt) {
            await clinicalApiService.createPatient({
              name: displayName,
              email: lowerEmail,
              primaryDiagnosis: 'General Clinical Intake',
            }).catch(() => null);
          }

          loginWithCustomProfile(userProfile);
          setSuccessMsg(`Welcome back, ${displayName}! Redirecting to Patient Portal...`);
        }

        setTimeout(() => {
          setIsLoading(false);
          onClose();
          router.push('/patient');
        }, 1000);
      } else if (selectedRole === 'doctor') {
        const rawName = lowerEmail
          .split('@')[0]
          .split('.')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
        const displayName = rawName ? (rawName.toLowerCase().startsWith('dr') ? rawName : `Dr. ${rawName}`) : 'Attending Physician';
        const doctorProfile: UserProfile = {
          id: `doc-${Date.now().toString(36)}`,
          name: displayName,
          email: lowerEmail,
          role: 'doctor',
          roleTitle: 'Attending Physician',
          department: 'Clinical Medicine',
          organization: 'CareNest Health System',
          permissions: ROLE_DEFINITIONS.doctor.permissions,
        };
        loginWithCustomProfile(doctorProfile);
        setSuccessMsg(`Welcome, ${displayName}! Redirecting to Doctor Portal...`);
        setTimeout(() => {
          setIsLoading(false);
          onClose();
          router.push('/doctor');
        }, 1000);
      } else if (selectedRole === 'admin') {
        if (lowerEmail.includes('arthur.davis') || lowerEmail.includes('admin-01')) {
          switchPersona('admin-01');
          setSuccessMsg('Authenticated as Arthur Davis, CISSP. Redirecting to Admin Console...');
        } else {
          const rawName = lowerEmail
            .split('@')[0]
            .split('.')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
          const displayName = rawName || 'System Administrator';
          const adminProfile: UserProfile = {
            id: `admin-${Date.now().toString(36)}`,
            name: displayName,
            email: lowerEmail,
            role: 'admin',
            roleTitle: 'Compliance & Security Officer',
            department: 'Health Informatics & Security',
            organization: 'CareNest Health System',
            permissions: ROLE_DEFINITIONS.admin.permissions,
          };
          loginWithCustomProfile(adminProfile);
          setSuccessMsg(`Authenticated as ${displayName}. Redirecting to Admin Console...`);
        }
        setTimeout(() => {
          setIsLoading(false);
          onClose();
          router.push('/admin');
        }, 1000);
      }
    } catch (err: unknown) {
      setIsLoading(false);
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to authenticate.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const cleanName = registerForm.fullName.trim();
    const cleanEmail = registerForm.email.trim();
    const cleanPhone = registerForm.phone.trim() || '(555) 019-2000';
    const cleanDob = registerForm.dob || '1992-06-14';

    if (!cleanName) {
      setError('Please enter your full legal name.');
      return;
    }
    if (!cleanEmail.includes('@')) {
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

    try {
      if (!DEMO_AUTH_ENABLED) {
        const res = await iamAuthService.registerPatient({
          fullName: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          dob: cleanDob,
          password: registerForm.password,
          consent: registerForm.consent,
        });
        if (!res.success || !res.data?.user) {
          throw new Error(res.message || 'Patient registration failed.');
        }
        await clinicalApiService.createPatient({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          dob: cleanDob,
          age: 32,
          gender: 'Not specified',
          bloodType: 'O+',
          primaryDiagnosis: 'Patient Self-Registered · Initial Assessment Scheduled',
        }).catch(() => null);
        loginWithIAM(res.data.user);
        setSuccessMsg(`Account created for ${cleanName}! Redirecting to your health portal...`);
        setTimeout(() => {
          setIsLoading(false);
          onClose();
          router.push('/patient');
        }, 1000);
        return;
      }

      // 1. Create patient record in backend clinical database so doctor workstation has their chart immediately
      await clinicalApiService.createPatient({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        dob: cleanDob,
        age: 32,
        gender: 'Not specified',
        bloodType: 'O+',
        primaryDiagnosis: 'Patient Self-Registered · Initial Assessment Scheduled',
      });

      // 2. Create UserProfile for authenticated session
      const newProfile: UserProfile = {
        id: `pat-${Date.now().toString(36)}`,
        name: cleanName,
        email: cleanEmail,
        role: 'patient',
        roleTitle: 'Registered Patient',
        department: 'Primary Care',
        organization: 'CareNest Health System',
        permissions: ROLE_DEFINITIONS.patient.permissions,
      };

      // 3. Log in with custom profile
      loginWithCustomProfile(newProfile);
      setSuccessMsg(`Account created for ${cleanName}! Redirecting to your personal health portal...`);

      setTimeout(() => {
        setIsLoading(false);
        onClose();
        router.push('/patient');
      }, 1000);
    } catch (err: unknown) {
      setIsLoading(false);
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to register account.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="multi-role-auth-title"
        className="bg-[#051322] border border-[#16d9f5]/35 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-[0_20px_60px_rgba(2,11,20,0.9)] relative text-white max-h-[90vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close sign-in dialog"
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
          <h2 id="multi-role-auth-title" className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {authMode === 'register' ? 'Create Patient Account' : DEMO_AUTH_ENABLED ? 'MiPAAS Demo Workspace Access' : 'MiPAAS Healthcare Access'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {authMode === 'register'
              ? 'Enroll in your personal digital health portal'
              : 'Select your clinical role to sign in to your authorized workspace'}
          </p>
        </div>

        {DEMO_AUTH_ENABLED && authMode === 'login' && (
          <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
            Demo mode: credentials are not verified and role selection is simulated. Do not enter real patient information.
          </div>
        )}

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
                      ? 'patient@carenest.health'
                      : selectedRole === 'doctor'
                      ? 'doctor@mipaas.health'
                      : 'admin@mipaas.health'
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
                  onClick={() => {
                    setError(null);
                    setSuccessMsg('If an account exists for this email, a password reset link will be sent.');
                  }}
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
                🔒 Doctor workstation is restricted to verified healthcare professionals with valid clinical credentials.
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
