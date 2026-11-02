'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Heart,
  Activity,
  FileText,
  ShieldCheck,
  Stethoscope,
  Calendar,
  Layers,
  Sparkles,
  Lock,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Pill,
  User,
  Settings,
  LogOut,
  Bell,
  Search,
  X,
  Menu,
  Shield,
  Home,
  Zap,
  CheckCircle2,
  Info,
  Upload,
  Edit3,
  Building,
  Mail,
  BadgeCheck,
  AlertTriangle,
  KeyRound,
  UserCheck,
  FileCheck2,
} from 'lucide-react';
import { useRBAC } from '@/context/RBACContext';
import { ROLE_DEFINITIONS, CLINICAL_PERSONAS } from '@/types/rbac';
import EkaCareHub from './EkaCareHub';
import OpenEMRHub from './OpenEMRHub';
import PatientPortal from './PatientPortal';
import AbhaAarogyaSetuHub from './AbhaAarogyaSetuHub';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type PortalSection = 'dashboard' | 'abha' | 'eka' | 'clinical' | 'reports' | 'profile' | 'settings';
export type OpenEMRPortalTab = 'abha' | 'eka' | 'clinical' | 'reports';

interface OpenEMRUnifiedPortalProps {
  initialTab?: OpenEMRPortalTab;
}

interface NavItem {
  id: PortalSection;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  accent: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', sublabel: 'Overview & Summary', icon: Home, accent: '#00DCCE' },
  { id: 'abha', label: 'ABHA & Aarogya Setu', sublabel: 'Gov Health ID & Shield', icon: ShieldCheck, accent: '#FF9933', badge: 'Gov' },
  { id: 'eka', label: 'Eka.care PHR', sublabel: 'Vitals, Meds & Family', icon: Heart, accent: '#FF5A78', badge: 'Live' },
  { id: 'clinical', label: 'OpenEMR Clinical', sublabel: 'MPI, Encounters & FHIR R4', icon: Stethoscope, accent: '#7C5CFC' },
  { id: 'reports', label: 'Certified Reports', sublabel: 'AI Scans & Findings', icon: FileText, accent: '#10B981', badge: 'AI' },
];

const BOTTOM_NAV: NavItem[] = [
  { id: 'profile', label: 'My Profile', sublabel: 'Identity & Preferences', icon: User, accent: '#F5A623' },
  { id: 'settings', label: 'Portal Settings', sublabel: 'Privacy & Security', icon: Settings, accent: '#98AED9' },
];

// ─────────────────────────────────────────────
// Dashboard Overview
// ─────────────────────────────────────────────
function DashboardOverview({ onNavigate }: { onNavigate: (s: PortalSection) => void }) {
  const { currentUser, iamUser, isIamAuthenticated, currentRole } = useRBAC();
  const roleMeta = ROLE_DEFINITIONS[currentRole];
  const displayName = iamUser?.username ?? currentUser.name;
  const displayEmail = iamUser?.email ?? currentUser.email;

  const stats = [
    { label: 'Health Records', value: '14', icon: FileText, color: '#10B981', change: '+2 this week', section: 'reports' as PortalSection },
    { label: 'Medications', value: '3', icon: Pill, color: '#00DCCE', change: '1 due today', section: 'eka' as PortalSection },
    { label: 'Appointments', value: '2', icon: Calendar, color: '#7C5CFC', change: 'Next: Nov 4', section: 'clinical' as PortalSection },
    { label: 'Vitals Logged', value: '26', icon: Activity, color: '#FF5A78', change: '+1 today', section: 'eka' as PortalSection },
  ];

  const activities = [
    { icon: FileCheck2, text: 'Chest X-Ray report certified by Dr. Elena Vance', time: '2h ago', color: '#10B981' },
    { icon: Pill, text: 'Lisinopril 10mg — taken this morning', time: '6h ago', color: '#00DCCE' },
    { icon: Activity, text: 'Blood pressure logged: 128/82 mmHg — Normal', time: '8h ago', color: '#7C5CFC' },
    { icon: Calendar, text: 'Appointment confirmed: Dr. Kavita Rao — Nov 4', time: '1d ago', color: '#FF7869' },
    { icon: Upload, text: 'MRI Brain scan uploaded to health locker', time: '2d ago', color: '#F5A623' },
  ];

  const quickActions = [
    { label: 'ABHA & Aarogya Setu', icon: ShieldCheck, section: 'abha' as PortalSection, color: '#FF9933' },
    { label: 'View PHR Hub', icon: Heart, section: 'eka' as PortalSection, color: '#FF5A78' },
    { label: 'Clinical Hub', icon: Stethoscope, section: 'clinical' as PortalSection, color: '#7C5CFC' },
    { label: 'AI Reports', icon: Sparkles, section: 'reports' as PortalSection, color: '#10B981' },
    { label: 'My Profile', icon: User, section: 'profile' as PortalSection, color: '#F5A623' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-8"
        style={{ background: 'linear-gradient(135deg, #0A1823 0%, #0E2030 50%, #0A1823 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, rgba(0,220,206,0.04) 0%, transparent 50%, rgba(124,92,252,0.04) 100%)' }} />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'rgba(0,220,206,0.03)', filter: 'blur(60px)' }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl"
                style={{ background: `linear-gradient(135deg, ${roleMeta.badgeBg}, ${roleMeta.borderColor})`, border: `2px solid ${roleMeta.borderColor}` }}>
                <span style={{ color: roleMeta.badgeColor }}>{displayName.charAt(0).toUpperCase()}</span>
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">{displayName}</h2>
                {isIamAuthenticated && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    <BadgeCheck className="w-3 h-3" /> IAM Verified
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-0.5">{displayEmail}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                  style={{ color: roleMeta.badgeColor, background: roleMeta.badgeBg, borderColor: roleMeta.borderColor }}>
                  {roleMeta.title}
                </span>
                <span className="text-xs text-slate-500">{currentUser.organization}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-right">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ABHA Linked & Active
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-xs justify-end">
              <Lock className="w-3 h-3 text-cyan-400" /> AES-256 Encrypted Locker
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-xs justify-end">
              <Layers className="w-3 h-3 text-purple-400" /> HL7 FHIR R4 Synced
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <button key={stat.label} type="button" onClick={() => onNavigate(stat.section)}
            className="group text-left rounded-2xl p-5 hover:border-white/20 transition-all hover:shadow-xl cursor-pointer"
            style={{ background: '#0A1823', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}18` }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </div>
            <div className="text-3xl font-black text-white mb-1">{stat.value}</div>
            <div className="text-xs font-semibold text-slate-300">{stat.label}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.change}</div>
          </button>
        ))}
      </div>

      {/* Quick Actions + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl p-5" style={{ background: '#0A1823', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" /> Quick Navigation
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => (
              <button key={a.label} type="button" onClick={() => onNavigate(a.section)}
                className="flex flex-col items-center gap-2.5 p-3 rounded-xl border border-white/8 hover:border-white/20 transition-all group"
                style={{ background: `${a.color}10` }}>
                <a.icon className="w-5 h-5" style={{ color: a.color }} />
                <span className="text-xs font-semibold text-slate-300 group-hover:text-white text-center leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: '#0A1823', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" /> Recent Activity
          </h3>
          <div className="space-y-3">
            {activities.map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${a.color}18` }}>
                  <a.icon className="w-3.5 h-3.5" style={{ color: a.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 leading-relaxed">{a.text}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="rounded-2xl p-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs"
        style={{ background: '#0A1823', border: '1px solid rgba(255,255,255,0.06)' }}>
        {['OpenEMR Backend: Online', 'Eka.care PHR: Synced', 'FHIR R4 Bridge: Active', 'ABHA/ABDM: Linked'].map((s) => (
          <div key={s} className="flex items-center gap-2 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {s}
          </div>
        ))}
        <div className="ml-auto text-slate-500">Last sync: {new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// User Profile
// ─────────────────────────────────────────────
function UserProfileSection() {
  const { currentUser, iamUser, isIamAuthenticated, switchPersona, currentRole, logoutIAM } = useRBAC();
  const roleMeta = ROLE_DEFINITIONS[currentRole];
  const [editMode, setEditMode] = useState(false);
  const [showPersona, setShowPersona] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const displayName = iamUser?.username ?? currentUser.name;
  const displayEmail = iamUser?.email ?? currentUser.email;

  const fields = [
    { icon: User, label: 'Full Name', value: displayName, readonly: false },
    { icon: Mail, label: 'Email', value: displayEmail, readonly: false },
    { icon: Building, label: 'Organization', value: currentUser.organization, readonly: false },
    { icon: Layers, label: 'Department', value: currentUser.department, readonly: false },
    { icon: Shield, label: 'Role', value: roleMeta.title, readonly: true },
    { icon: KeyRound, label: 'User ID', value: iamUser?.id ?? currentUser.id, readonly: true },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <h2 className="text-xl font-bold text-white">My Profile</h2>

      {/* Identity Card */}
      <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#0A1823' }}>
        <div className="h-24 relative"
          style={{ background: `linear-gradient(135deg, ${roleMeta.badgeBg}CC, ${roleMeta.borderColor}88)` }}>
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }} />
        </div>
        <div className="px-6 pb-6">
          <div className="relative -mt-10 mb-4 flex items-end justify-between">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black shadow-2xl border-4"
              style={{ background: `linear-gradient(135deg, ${roleMeta.badgeBg}, ${roleMeta.borderColor})`, borderColor: '#0A1823', color: roleMeta.badgeColor }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex gap-2 mb-1">
              {isIamAuthenticated && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  <BadgeCheck className="w-3.5 h-3.5" /> IAM Verified
                </span>
              )}
              <button type="button" onClick={() => setEditMode(!editMode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors">
                <Edit3 className="w-3.5 h-3.5" /> {editMode ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>
          <h3 className="text-xl font-bold text-white">{displayName}</h3>
          <p className="text-sm text-slate-400">{displayEmail}</p>
          <div className="mt-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold border"
              style={{ color: roleMeta.badgeColor, background: roleMeta.badgeBg, borderColor: roleMeta.borderColor }}>
              {roleMeta.title}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            {fields.map((f) => (
              <div key={f.label} className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <f.icon className="w-3 h-3" /> {f.label}
                </label>
                {editMode ? (
                  <input className="w-full rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    style={{ background: '#071018', border: '1px solid rgba(255,255,255,0.1)' }}
                    defaultValue={f.value} readOnly={f.readonly} />
                ) : (
                  <p className="text-sm text-slate-200 font-medium truncate">{f.value}</p>
                )}
              </div>
            ))}
          </div>

          {editMode && (
            <div className="mt-5 flex gap-3">
              <button type="button" className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: '#00DCCE', color: '#0A1823' }}>
                Save Changes
              </button>
              <button type="button" onClick={() => setEditMode(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Persona Switcher */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: '#0A1823' }}>
        <button type="button" onClick={() => setShowPersona(!showPersona)}
          className="w-full flex items-center justify-between text-sm font-semibold text-white">
          <span className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-cyan-400" /> Switch Clinical Persona
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPersona ? 'rotate-180' : ''}`} />
        </button>

        {showPersona && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-slate-400 mb-3">Switch to a different clinical role to explore different permissions and views.</p>
            {Object.values(CLINICAL_PERSONAS).map((persona) => {
              const pRole = ROLE_DEFINITIONS[persona.role];
              const isActive = currentUser.id === persona.id;
              return (
                <button key={persona.id} type="button" onClick={() => switchPersona(persona.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
                  style={{ borderColor: isActive ? 'rgba(0,220,206,0.4)' : 'rgba(255,255,255,0.06)', background: isActive ? 'rgba(0,220,206,0.05)' : 'transparent' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: pRole.badgeBg, color: pRole.badgeColor, border: `1px solid ${pRole.borderColor}` }}>
                    {persona.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-200 truncate">{persona.name}</div>
                    <div className="text-xs text-slate-500">{persona.roleTitle}</div>
                  </div>
                  {isActive && <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Permissions */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: '#0A1823' }}>
        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" /> Active Permissions ({roleMeta.permissions.length})
        </h4>
        <div className="flex flex-wrap gap-2">
          {roleMeta.permissions.map((perm) => (
            <span key={perm} className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              {perm}
            </span>
          ))}
        </div>
      </div>

      {/* Logout */}
      {isIamAuthenticated && (
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: '#0A1823' }}>
          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <LogOut className="w-4 h-4 text-red-400" /> Session Management
          </h4>
          {!confirmLogout ? (
            <button type="button" onClick={() => setConfirmLogout(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors">
              <LogOut className="w-4 h-4" /> Sign Out of IAM Session
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-400">Are you sure you want to sign out?</p>
              <button type="button" onClick={() => logoutIAM()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors">
                Yes, Sign Out
              </button>
              <button type="button" onClick={() => setConfirmLogout(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-slate-300 hover:bg-white/10 transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Portal Settings
// ─────────────────────────────────────────────
function PortalSettingsSection() {
  const [notifs, setNotifs] = useState({ email: true, sms: false, push: true });
  const [privacy, setPrivacy] = useState({ abdmShare: true, aiConsult: true, analytics: false });
  const [mfa, setMfa] = useState(true);
  const [timeout, setTimeout_] = useState('30');

  function Toggle({ on, onToggle, color = '#00DCCE' }: { on: boolean; onToggle: () => void; color?: string }) {
    return (
      <button type="button" onClick={onToggle}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: on ? color : '#334155' }}>
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <h2 className="text-xl font-bold text-white">Portal Settings</h2>

      {/* Notifications */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: '#0A1823' }}>
        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-cyan-400" /> Notification Preferences
        </h4>
        <div className="space-y-4">
          {[
            { key: 'email', label: 'Email Notifications', desc: 'Appointment reminders, lab results, medication alerts' },
            { key: 'sms', label: 'SMS Notifications', desc: 'Critical health alerts and appointment reminders' },
            { key: 'push', label: 'Push Notifications', desc: 'Real-time updates from the portal' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 py-1">
              <div>
                <p className="text-sm font-semibold text-slate-200">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
              <Toggle on={notifs[item.key as keyof typeof notifs]}
                onToggle={() => setNotifs((p) => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))} />
            </div>
          ))}
        </div>
      </div>

      {/* Privacy */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: '#0A1823' }}>
        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400" /> Privacy & Consent
        </h4>
        <div className="space-y-4">
          {[
            { key: 'abdmShare', label: 'ABHA / ABDM Health Record Sharing', desc: 'Share health records with authorized providers via ABHA network', color: '#7C5CFC' },
            { key: 'aiConsult', label: 'AI Doctor Consultation', desc: 'Allow AI to access your health records for personalized medical advice', color: '#10B981' },
            { key: 'analytics', label: 'Anonymous Analytics', desc: 'Contribute anonymized data to improve AI diagnostic models', color: '#F5A623' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 py-1">
              <div>
                <p className="text-sm font-semibold text-slate-200">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
              <Toggle on={privacy[item.key as keyof typeof privacy]} color={item.color}
                onToggle={() => setPrivacy((p) => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))} />
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: '#0A1823' }}>
        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400" /> Security Settings
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 py-1">
            <div>
              <p className="text-sm font-semibold text-slate-200">Two-Factor Authentication (MFA)</p>
              <p className="text-xs text-slate-500 mt-0.5">Require a second factor on every sign-in</p>
            </div>
            <Toggle on={mfa} color="#F5A623" onToggle={() => setMfa(!mfa)} />
          </div>
          <div className="py-1">
            <p className="text-sm font-semibold text-slate-200 mb-1">Session Timeout</p>
            <p className="text-xs text-slate-500 mb-3">Auto sign out after inactivity</p>
            <select value={timeout} onChange={(e) => setTimeout_(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
              style={{ background: '#071018', border: '1px solid rgba(255,255,255,0.1)' }}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="480">8 hours (Work session)</option>
            </select>
          </div>
          <div className="pt-2 flex gap-3">
            <button type="button" className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors">
              Change Password
            </button>
            <button type="button" className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors">
              Download Audit Logs
            </button>
          </div>
        </div>
      </div>

      {/* Portal Info */}
      <div className="rounded-2xl border border-white/10 p-5" style={{ background: '#0A1823' }}>
        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400" /> Portal Information
        </h4>
        <div className="grid grid-cols-2 gap-4 text-xs">
          {[
            ['Portal Version', 'MiPAAS v2.4.1'],
            ['OpenEMR Version', '7.0.3-FHIR-R4'],
            ['Eka.care API', 'PHR-SDK v3.1'],
            ['ABHA Spec', 'ABDM Health ID 2.0'],
            ['FHIR Spec', 'HL7 FHIR R4.0.1'],
            ['Encryption', 'AES-256-GCM'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-slate-500">{label}</p>
              <p className="text-slate-300 font-semibold mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Left Sidebar
// ─────────────────────────────────────────────
interface LeftSidebarProps {
  activeSection: PortalSection;
  onNavigate: (s: PortalSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function LeftSidebar({ activeSection, onNavigate, collapsed, onToggleCollapse }: LeftSidebarProps) {
  const { currentUser, iamUser, isIamAuthenticated, currentRole, logoutIAM } = useRBAC();
  const roleMeta = ROLE_DEFINITIONS[currentRole];
  const displayName = iamUser?.username ?? currentUser.name;

  return (
    <aside
      className="relative flex flex-col border-r transition-all duration-300 ease-in-out flex-shrink-0"
      style={{
        minHeight: '100vh',
        width: collapsed ? '68px' : '240px',
        background: '#060E17',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Brand */}
      <div className={`flex items-center h-16 px-4 border-b gap-3 ${collapsed ? 'justify-center' : ''}`}
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-950 font-black text-sm shadow-md"
            style={{ background: 'linear-gradient(135deg, #00DCCE, #7C5CFC)' }}>M</div>
          {!collapsed && (
            <div>
              <div className="text-xs font-black text-white leading-none">MiPAAS</div>
              <div className="text-xs text-slate-500">OpenEMR Portal</div>
            </div>
          )}
        </Link>
        {!collapsed ? (
          <button type="button" title="Collapse sidebar" onClick={onToggleCollapse}
            className="ml-auto p-1.5 rounded-lg hover:bg-white/8 text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" title="Expand sidebar" onClick={onToggleCollapse}
            className="absolute -right-3.5 top-5 w-7 h-7 rounded-full border flex items-center justify-center shadow-md hover:bg-white/10 transition-colors z-10"
            style={{ background: '#0A1823', borderColor: 'rgba(255,255,255,0.15)' }}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          </button>
        )}
      </div>

      {/* User Chip */}
      {!collapsed ? (
        <div className="mx-3 my-3 p-3 rounded-xl border cursor-pointer hover:border-white/20 transition-colors"
          onClick={() => onNavigate('profile')}
          style={{ background: `${roleMeta.badgeBg}55`, borderColor: `${roleMeta.borderColor}55` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
              style={{ background: roleMeta.badgeBg, color: roleMeta.badgeColor, border: `1.5px solid ${roleMeta.borderColor}` }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{displayName.split(' ')[0]}</div>
              <div className="text-xs text-slate-500 truncate">{roleMeta.title}</div>
            </div>
            {isIamAuthenticated && <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 ml-auto" />}
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-3 w-10 h-10 rounded-xl flex items-center justify-center font-black cursor-pointer"
          onClick={() => onNavigate('profile')} title={displayName}
          style={{ background: roleMeta.badgeBg, color: roleMeta.badgeColor, border: `1.5px solid ${roleMeta.borderColor}` }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Modules label */}
      {!collapsed && (
        <div className="px-4 pt-2 pb-1">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Modules</span>
        </div>
      )}

      {/* Main Nav */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button key={item.id} type="button" onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${collapsed ? 'justify-center' : ''}`}
              style={{
                color: isActive ? 'white' : 'rgba(148,163,184,0.9)',
                background: isActive ? `${item.accent}14` : 'transparent',
                boxShadow: isActive ? `inset 0 0 0 1px ${item.accent}28` : 'none',
              }}>
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" style={{ color: isActive ? item.accent : undefined }} />
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{item.label}</div>
                    <div className="text-xs text-slate-500 truncate leading-none mt-0.5">{item.sublabel}</div>
                  </div>
                  {item.badge && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: `${item.accent}20`, color: item.accent, border: `1px solid ${item.accent}40` }}>
                      {item.badge}
                    </span>
                  )}
                  {isActive && <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: item.accent }} />}
                </>
              )}
            </button>
          );
        })}

        <div className="my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        {!collapsed && (
          <div className="px-1 pb-1">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Other Portals</span>
          </div>
        )}

        <Link href="/doctor" title="Doctor Workstation"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all ${collapsed ? 'justify-center' : ''}`}>
          <Activity className="w-[18px] h-[18px] flex-shrink-0 text-cyan-400" />
          {!collapsed && <span className="text-xs font-semibold">Doctor Workstation</span>}
        </Link>

        <Link href="/admin" title="Admin Hub"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all ${collapsed ? 'justify-center' : ''}`}>
          <ShieldCheck className="w-[18px] h-[18px] flex-shrink-0 text-amber-400" />
          {!collapsed && <span className="text-xs font-semibold">Admin Hub</span>}
        </Link>
      </nav>

      {/* Bottom Nav */}
      <div className="px-2 pb-3 space-y-0.5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {BOTTOM_NAV.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button key={item.id} type="button" onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${collapsed ? 'justify-center' : ''}`}
              style={{
                color: isActive ? 'white' : 'rgba(100,116,139,0.9)',
                background: isActive ? `${item.accent}14` : 'transparent',
                boxShadow: isActive ? `inset 0 0 0 1px ${item.accent}28` : 'none',
              }}>
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" style={{ color: isActive ? item.accent : undefined }} />
              {!collapsed && <span className="text-xs font-semibold truncate">{item.label}</span>}
            </button>
          );
        })}

        {isIamAuthenticated && (
          <button type="button" onClick={() => logoutIAM()} title="Sign Out"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all ${collapsed ? 'justify-center' : ''}`}>
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span className="text-xs font-semibold">Sign Out</span>}
          </button>
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// Top Bar
// ─────────────────────────────────────────────
function TopBar({ activeSection, onMobileMenuToggle }: { activeSection: PortalSection; onMobileMenuToggle: () => void }) {
  const { currentUser, iamUser, isIamAuthenticated } = useRBAC();
  const [searchOpen, setSearchOpen] = useState(false);
  const displayName = iamUser?.username ?? currentUser.name;

  const meta: Record<PortalSection, { label: string; icon: React.ElementType; color: string }> = {
    dashboard: { label: 'Dashboard', icon: Home, color: '#00DCCE' },
    abha: { label: 'ABHA & Aarogya Setu Government Hub', icon: ShieldCheck, color: '#FF9933' },
    eka: { label: 'Eka.care Personal Health Records', icon: Heart, color: '#FF5A78' },
    clinical: { label: 'OpenEMR Clinical Hub', icon: Stethoscope, color: '#7C5CFC' },
    reports: { label: 'Certified Reports & AI Findings', icon: FileText, color: '#10B981' },
    profile: { label: 'My Profile', icon: User, color: '#F5A623' },
    settings: { label: 'Portal Settings', icon: Settings, color: '#98AED9' },
  };

  const m = meta[activeSection] || meta.dashboard;

  return (
    <header className="h-16 flex items-center px-4 sm:px-6 gap-4 flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,14,23,0.8)', backdropFilter: 'blur(12px)' }}>
      <button type="button" onClick={onMobileMenuToggle}
        className="lg:hidden p-2 rounded-xl hover:bg-white/8 text-slate-400 hover:text-white transition-colors">
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${m.color}18` }}>
          <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{m.label}</h1>
          <p className="text-xs text-slate-500 hidden sm:block">MiPAAS · OpenEMR Unified User Portal</p>
        </div>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center">
        {searchOpen ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input autoFocus className="bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none w-40"
              placeholder="Search health records..." onBlur={() => setSearchOpen(false)} />
            <button type="button" onClick={() => setSearchOpen(false)}><X className="w-3.5 h-3.5 text-slate-500" /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setSearchOpen(true)} className="p-2 rounded-xl hover:bg-white/8 text-slate-500 hover:text-slate-300 transition-colors">
            <Search className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ABHA status */}
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-emerald-300 text-xs font-medium"
        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ABHA Active
      </div>

      {/* Notifications */}
      <button type="button" className="relative p-2 rounded-xl hover:bg-white/8 text-slate-400 hover:text-white transition-colors">
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
      </button>

      {/* User chip */}
      <Link href="/login" className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors">
        {isIamAuthenticated ? (
          <><span className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-xs font-semibold text-white">{displayName.split(' ')[0]}</span></>
        ) : (
          <><User className="w-3.5 h-3.5 text-slate-400" /><span className="text-xs text-slate-400">Login</span></>
        )}
      </Link>
    </header>
  );
}

// ─────────────────────────────────────────────
// Main Portal Inner
// ─────────────────────────────────────────────
function OpenEMRUnifiedPortalInner({ initialTab = 'eka' }: OpenEMRUnifiedPortalProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initSection: PortalSection = initialTab === 'clinical' ? 'clinical' : initialTab === 'reports' ? 'reports' : initialTab === 'abha' ? 'abha' : 'eka';
  const validSections: PortalSection[] = ['dashboard', 'abha', 'eka', 'clinical', 'reports', 'profile', 'settings'];
  const sectionQuery = searchParams.get('section') as PortalSection | null;

  const [activeSection, setActiveSection] = useState<PortalSection>(() => {
    if (sectionQuery && validSections.includes(sectionQuery)) return sectionQuery;
    return initSection;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (sectionQuery && validSections.includes(sectionQuery)) {
      setActiveSection(sectionQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionQuery]);

  const navigate = useCallback((section: PortalSection) => {
    setActiveSection(section);
    setMobileSidebarOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', section);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard': return <DashboardOverview onNavigate={navigate} />;
      case 'abha': return <AbhaAarogyaSetuHub />;
      case 'eka': return <EkaCareHub />;
      case 'clinical': return <OpenEMRHub />;
      case 'reports': return <PatientPortal />;
      case 'profile': return <UserProfileSection />;
      case 'settings': return <PortalSettingsSection />;
      default: return <DashboardOverview onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex" style={{ background: '#070E14', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <LeftSidebar
          activeSection={activeSection}
          onNavigate={navigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative z-10 w-[260px] flex-shrink-0">
            <LeftSidebar
              activeSection={activeSection}
              onNavigate={navigate}
              collapsed={false}
              onToggleCollapse={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <TopBar activeSection={activeSection} onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Public Export
// ─────────────────────────────────────────────
export default function OpenEMRUnifiedPortal(props: OpenEMRUnifiedPortalProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070E14' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#00DCCE', borderTopColor: 'transparent' }} />
          <div className="text-center">
            <p className="text-sm font-bold text-white">Loading OpenEMR User Portal</p>
            <p className="text-xs text-slate-500 mt-1">Initializing Eka.care PHR + OpenEMR Clinical + FHIR R4</p>
          </div>
        </div>
      </div>
    }>
      <OpenEMRUnifiedPortalInner {...props} />
    </Suspense>
  );
}
