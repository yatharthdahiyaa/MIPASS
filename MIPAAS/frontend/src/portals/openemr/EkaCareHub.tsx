'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ekaPortalService,
  PortalAuthError,
  type Appointment,
  type EkaSession,
  type FamilyMember,
  type HealthRecord,
  type Medication,
  type PortalIdentity,
  type VitalRecord,
} from '@/services/ekaPortalService';
import { useRBAC } from '@/context/RBACContext';
import {
  Heart,
  Activity,
  Calendar,
  Clock,
  Plus,
  Check,
  CheckCircle2,
  AlertCircle,
  FileText,
  UploadCloud,
  Download,
  Share2,
  Search,
  Filter,
  Pill,
  Stethoscope,
  QrCode,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  User,
  Users,
  Bell,
  ArrowRight,
  X,
  ExternalLink,
  Eye,
  RefreshCw,
  Sparkles,
  MessageSquare,
  Send,
  TrendingUp,
  TrendingDown,
  Info,
  Phone,
  MapPin,
  Video,
  FileCheck2,
  Lock,
  Thermometer,
  Zap,
} from 'lucide-react';

type ChatMessage = { sender: 'user' | 'ai'; text: string; time: string };

function renderChatText(text: string) {
  return text.split('**').map((segment, i) =>
    i % 2 === 1 ? <strong key={i}>{segment}</strong> : segment
  );
}

export default function EkaCareHub() {
  const { currentUser, iamUser, isIamAuthenticated } = useRBAC();
  const identity = useMemo<PortalIdentity>(
    () => ({ userId: iamUser?.id ?? currentUser.id, role: currentUser.role }),
    [iamUser?.id, currentUser.id, currentUser.role]
  );

  // Portal Session & Data Access State
  const [session, setSession] = useState<EkaSession | null>(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [memberDataLoading, setMemberDataLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Family Profiles (served by MiPAAS /api/v1/eka/family)
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [activeProfile, setActiveProfile] = useState<FamilyMember | null>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'today' | 'records' | 'vitals' | 'meds' | 'appointments' | 'abha' | 'ai_chat'>('today');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [recordFilter, setRecordFilter] = useState<string>('All');

  // Today's Medications State (MiPAAS /eka/members/:id/medications)
  const [medications, setMedications] = useState<Medication[]>([]);

  // Vitals State (MiPAAS /eka/members/:id/vitals)
  const [vitals, setVitals] = useState<VitalRecord[]>([]);

  // Health Records in Locker (MiPAAS /eka/members/:id/records)
  const [records, setRecords] = useState<HealthRecord[]>([]);

  // Appointments State (MiPAAS /eka/members/:id/appointments)
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Modals & Drawers
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [showLogVitalModal, setShowLogVitalModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBookAptModal, setShowBookAptModal] = useState(false);

  // Form Inputs for New Vital
  const [newVitalType, setNewVitalType] = useState<string>('Blood Pressure');
  const [newVitalValue, setNewVitalValue] = useState<string>('');
  const [newVitalUnit, setNewVitalUnit] = useState<string>('mmHg');

  // Form Inputs for New Record
  const [newRecTitle, setNewRecTitle] = useState('');
  const [newRecCategory, setNewRecCategory] = useState<HealthRecord['category']>('Lab Reports');
  const [newRecDoctor, setNewRecDoctor] = useState('');

  // AI Chat Messages State (welcome message seeded after session load)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Appointment Booking Form (controlled, served by MiPAAS scheduler)
  const [bookDoctor, setBookDoctor] = useState('Dr. Anurag Verma · Cardiology');
  const [bookMode, setBookMode] = useState<'In-Clinic' | 'Video Teleconsult'>('In-Clinic');
  const [bookDate, setBookDate] = useState('2026-10-16');
  const [isBooking, setIsBooking] = useState(false);
  const [savingVital, setSavingVital] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);

  const nowLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Load all clinical data for a family member from MiPAAS endpoints
  const loadMemberData = useCallback(
    async (memberId: string) => {
      setMemberDataLoading(true);
      setActionError(null);
      try {
        const [meds, vits, recs, apts] = await Promise.all([
          ekaPortalService.listMedications(identity, memberId),
          ekaPortalService.listVitals(identity, memberId),
          ekaPortalService.listRecords(identity, memberId),
          ekaPortalService.listAppointments(identity, memberId),
        ]);
        setMedications(meds.medications);
        setVitals(vits.vitals);
        setRecords(recs.records);
        setAppointments(apts.appointments);
      } catch (err) {
        setActionError((err as Error).message);
      } finally {
        setMemberDataLoading(false);
      }
    },
    [identity]
  );

  // Bootstrap the RBAC-verified portal session and family graph
  const loadPortal = useCallback(async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const [{ session: s }, { members }] = await Promise.all([
        ekaPortalService.getSession(identity),
        ekaPortalService.listFamily(identity),
      ]);
      setSession(s);
      setFamily(members);
      const primary = members.find((m) => m.id === s.primaryMemberId) ?? members[0];
      setActiveProfile(primary);
      setChatMessages([
        {
          sender: 'ai',
          text: `Namaste ${primary.name.split(' ')[0]}! I am your Eka.care Health Assistant powered by MiPAAS MEDITRON AI. Your session is verified — locker encryption ${s.consent.lockerEncryption}, ABHA linked, role: ${s.role}. How can I help you manage your health today?`,
          time: nowLabel(),
        },
      ]);
      await loadMemberData(primary.id);
    } catch (err) {
      const message =
        err instanceof PortalAuthError
          ? 'Your MiPAAS session is not authorized for the eka.care portal. Please sign in to continue.'
          : (err as Error)?.message ||
            'MiPAAS portal service is unreachable. Start the backend on :8080 and retry.';
      setPortalError(message);
    } finally {
      setPortalLoading(false);
    }
  }, [identity, loadMemberData]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const switchMember = (member: FamilyMember) => {
    setActiveProfile(member);
    setProfileDropdownOpen(false);
    void loadMemberData(member.id);
  };

  // Toggle Medication Taken (server-backed adherence)
  const toggleMedication = async (id: string) => {
    const med = medications.find((m) => m.id === id);
    if (!med) return;
    try {
      const { medication } = await ekaPortalService.setMedicationTaken(identity, id, !med.takenToday);
      setMedications((prev) => prev.map((m) => (m.id === id ? medication : m)));
      setActionError(null);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleAddFamilyMember = async () => {
    const name = window.prompt('Enter the name of the family member to link (ABHA OTP will be sent):');
    if (!name?.trim()) return;
    try {
      const { member } = await ekaPortalService.addFamilyMember(identity, {
        name: name.trim(),
        relation: 'Dependent',
      });
      setFamily((prev) => [...prev, member]);
      switchMember(member);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  // Add Vital (clinical status classified by MiPAAS backend)
  const handleSaveVital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !newVitalValue.trim()) return;
    setSavingVital(true);
    try {
      const { vital } = await ekaPortalService.logVital(identity, activeProfile.id, {
        type: newVitalType,
        value: newVitalValue.trim(),
        unit: newVitalUnit,
      });
      setVitals((prev) => [vital, ...prev]);
      setShowLogVitalModal(false);
      setNewVitalValue('');
      setActionError(null);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setSavingVital(false);
    }
  };

  // Add Record to the encrypted health locker
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !newRecTitle.trim()) return;
    setSavingRecord(true);
    try {
      const { record } = await ekaPortalService.uploadRecord(identity, activeProfile.id, {
        title: newRecTitle.trim(),
        category: newRecCategory,
        doctorOrLab: newRecDoctor.trim() || 'Self-Uploaded Document',
      });
      setRecords((prev) => [record, ...prev]);
      setShowUploadModal(false);
      setNewRecTitle('');
      setNewRecDoctor('');
      setActionError(null);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setSavingRecord(false);
    }
  };

  // Book appointment via MiPAAS scheduling endpoint
  const handleBookAppointment = async () => {
    if (!activeProfile) return;
    setIsBooking(true);
    try {
      const [doctorName, specialty] = bookDoctor.split(' · ');
      const { appointment } = await ekaPortalService.bookAppointment(identity, activeProfile.id, {
        doctorName,
        specialty,
        date: bookDate,
        time: bookMode === 'In-Clinic' ? '10:30 AM' : '05:00 PM',
        type: bookMode,
      });
      setAppointments((prev) => [appointment, ...prev]);
      setShowBookAptModal(false);
      setActionError(null);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      await ekaPortalService.cancelAppointment(identity, id);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'Cancelled' as const } : a))
      );
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  // Send AI Chat Message (grounded MEDITRON consult endpoint)
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeProfile) return;
    const text = chatInput.trim();
    setChatMessages((prev) => [...prev, { sender: 'user', text, time: nowLabel() }]);
    setChatInput('');
    setIsAiThinking(true);
    try {
      const { consult } = await ekaPortalService.consult(identity, activeProfile.id, text);
      setChatMessages((prev) => [...prev, { sender: 'ai', text: consult.reply, time: nowLabel() }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `The MiPAAS consultation service returned an error: ${(err as Error).message}. Please retry.`,
          time: nowLabel(),
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Filtered Records
  const filteredRecords = records.filter((r) => {
    const matchesCategory = recordFilter === 'All' || r.category === recordFilter;
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.doctorOrLab.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.aiKeySummary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate Today's Adherence
  const takenCount = medications.filter((m) => m.takenToday).length;
  const adherencePercentage = medications.length
    ? Math.round((takenCount / medications.length) * 100)
    : 0;

  // ── Production Access Gates ─────────────────────────────────
  if (portalLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#008280] to-[#0D9488] flex items-center justify-center shadow-lg shadow-teal-700/25 animate-pulse">
          <Heart className="w-7 h-7 text-white fill-white" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">Verifying MiPAAS session…</p>
          <p className="text-xs text-slate-500 mt-1">
            Loading your family health graph, encrypted locker &amp; ABHA profile
          </p>
        </div>
      </div>
    );
  }

  if (portalError || !activeProfile) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl bg-white border border-slate-200 p-8 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Portal Access Unavailable</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{portalError}</p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => void loadPortal()}
              className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-700/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-teal-500/20 selection:text-teal-900">
      {/* Top Header Bar with Crisp White & Teal Eka.care Identity */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand & Tagline */}
          <div className="flex items-center gap-3">
            <Link href="/eka" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#008280] to-[#0D9488] flex items-center justify-center shadow-md shadow-teal-700/20 group-hover:scale-105 transition-transform">
                <Heart className="w-5 h-5 text-white fill-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black tracking-tight text-slate-900">eka</span>
                  <span className="text-xl font-black text-[#0D9488]">.care</span>
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wider">
                    PHR Hub
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Day-to-Day Health Manager · ABHA Connected
                </p>
              </div>
            </Link>
          </div>

          {/* Center Links & ABDM Badge */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ABHA ID: {activeProfile.abhaId}</span>
              {session && (
                <span className="hidden lg:inline text-[10px] text-emerald-700 font-mono">
                  {session.consent.lockerEncryption}
                </span>
              )}
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {!isIamAuthenticated && (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold hover:bg-amber-100 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Guest Persona · Sign In for ABHA-verified access</span>
              </Link>
            )}

            <Link
              href="/agents"
              className="text-xs text-slate-500 hover:text-teal-700 transition-colors flex items-center gap-1 font-medium"
            >
              <span>Powered by MiPAAS AI Agents</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Family Profile Switcher & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold shadow-xs transition-all"
              >
                <div
                  className={`w-6 h-6 rounded-full bg-gradient-to-tr ${activeProfile.avatarColor} flex items-center justify-center text-[10px] font-bold text-white shadow-2xs`}
                >
                  {activeProfile.name[0]}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="block text-xs font-bold leading-tight text-slate-900">{activeProfile.name}</span>
                  <span className="block text-[10px] text-slate-500 leading-tight">({activeProfile.relation})</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Switch Family Member
                    </span>
                    <span className="text-xs text-slate-600">Manage health records &amp; vitals</span>
                  </div>
                  {family.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => switchMember(member)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all ${
                        activeProfile.id === member.id
                          ? 'bg-teal-50 text-teal-900 font-bold border border-teal-200'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full bg-gradient-to-tr ${member.avatarColor} flex items-center justify-center text-xs font-bold text-white shadow-2xs`}
                        >
                          {member.name[0]}
                        </div>
                        <div>
                          <span className="block leading-tight text-slate-900">{member.name}</span>
                          <span className="block text-[10px] text-slate-500 leading-tight">
                            {member.relation} · {member.age}y {member.gender[0]}
                          </span>
                        </div>
                      </div>
                      {activeProfile.id === member.id && <Check className="w-4 h-4 text-teal-600" />}
                    </button>
                  ))}
                  <div className="pt-2 border-t border-slate-100 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        void handleAddFamilyMember();
                      }}
                      className="w-full py-2 px-3 rounded-lg text-center text-xs font-semibold text-teal-700 hover:bg-teal-50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Family Profile</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Upload Button */}
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-700/20 transition-all cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span className="hidden sm:inline">Upload Record</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="max-w-7xl mx-auto mt-3 overflow-x-auto no-scrollbar flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'today'
                ? 'bg-[#0D9488] text-white shadow-sm shadow-teal-700/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Today&apos;s Routine</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'today' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {medications.filter((m) => !m.takenToday).length > 0 ? '1 Pending' : 'All Done'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'records'
                ? 'bg-[#0D9488] text-white shadow-sm shadow-teal-700/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Health Locker ({records.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vitals')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'vitals'
                ? 'bg-[#0D9488] text-white shadow-sm shadow-teal-700/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Vitals &amp; Trends</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('meds')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'meds'
                ? 'bg-[#0D9488] text-white shadow-sm shadow-teal-700/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            <span>Prescriptions &amp; Meds</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'appointments'
                ? 'bg-[#0D9488] text-white shadow-sm shadow-teal-700/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Appointments ({appointments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('abha')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'abha'
                ? 'bg-[#0D9488] text-white shadow-sm shadow-teal-700/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>ABHA Digital Card</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai_chat')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ml-auto ${
              activeTab === 'ai_chat'
                ? 'bg-purple-700 text-white shadow-sm shadow-purple-700/25'
                : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Ask AI Doctor</span>
          </button>
        </div>
      </header>

      {/* Live Sync & Action Feedback Banners */}
      {(memberDataLoading || actionError) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-2">
          {memberDataLoading && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing portal data for {activeProfile.name} from MiPAAS…</span>
            </div>
          )}
          {actionError && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {actionError}
              </span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="p-1 rounded-lg hover:bg-red-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* TAB 1: TODAY'S ROUTINE & SUMMARY */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            {/* Top Greeting & Daily Health Pulse */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 w-80 h-80 bg-teal-50/70 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div>
                  <div className="flex items-center gap-2 text-xs text-teal-700 font-bold mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date().toLocaleDateString('en-GB', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}{' '}
                      · Daily Health Schedule
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                    Good Day, {activeProfile.name.split(' ')[0]} 👋
                  </h1>
                  <p className="text-sm text-slate-600 mt-1.5 max-w-xl leading-relaxed">
                    Here is your day-to-day healthcare summary. You have taken{' '}
                    <strong className="text-slate-900 font-bold">
                      {takenCount} of {medications.length}
                    </strong>{' '}
                    scheduled medicines, and 1 consultation is confirmed for tomorrow.
                  </p>
                </div>

                {/* Daily Adherence Progress Ring */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="26" stroke="#E2E8F0" strokeWidth="6" fill="transparent" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke="#0D9488"
                        strokeWidth="6"
                        strokeDasharray={163}
                        strokeDashoffset={163 - (163 * adherencePercentage) / 100}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-xs font-black text-slate-900">{adherencePercentage}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Daily Adherence
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {adherencePercentage === 100 ? 'All Completed 🎉' : 'On Track'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {medications.length - takenCount} remaining today
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLogVitalModal(true)}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-teal-50/60 border border-slate-200/80 hover:border-teal-200 flex items-center gap-3 transition-all text-left group shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 group-hover:text-teal-900 block">Log Vitals</span>
                    <span className="text-[10px] text-slate-500 block">BP, Sugar, Weight</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-teal-50/60 border border-slate-200/80 hover:border-teal-200 flex items-center gap-3 transition-all text-left group shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                    <UploadCloud className="w-4 h-4 text-teal-700" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 group-hover:text-teal-900 block">Upload Report</span>
                    <span className="text-[10px] text-slate-500 block">Prescription / Scan</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBookAptModal(true)}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-teal-50/60 border border-slate-200/80 hover:border-teal-200 flex items-center gap-3 transition-all text-left group shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-purple-700" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 group-hover:text-teal-900 block">Book Consult</span>
                    <span className="text-[10px] text-slate-500 block">Doctor OPD / Video</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ai_chat')}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-teal-50/60 border border-slate-200/80 hover:border-teal-200 flex items-center gap-3 transition-all text-left group shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 group-hover:text-teal-900 block">Ask AI Doctor</span>
                    <span className="text-[10px] text-slate-500 block">Understand Reports</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Grid: Medications Schedule & Quick Vitals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Today's Pill Schedule */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Pill className="w-5 h-5 text-teal-600" />
                    <span>Today&apos;s Medicine Schedule</span>
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">Click circle to mark taken</span>
                </div>

                <div className="space-y-3">
                  {medications.map((med) => (
                    <div
                      key={med.id}
                      onClick={() => toggleMedication(med.id)}
                      className={`p-4.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 shadow-xs ${
                        med.takenToday
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-white border-slate-200/90 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                            med.takenToday
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30'
                              : 'bg-white border-slate-300 text-transparent hover:border-teal-500'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-bold ${
                                med.takenToday ? 'text-slate-400 line-through' : 'text-slate-900'
                              }`}
                            >
                              {med.name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {med.dosage}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="text-teal-700 font-semibold">{med.timeSlot}</span>
                            <span>•</span>
                            <span>{med.instruction}</span>
                            <span>•</span>
                            <span>By {med.prescribedBy}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${
                            med.takenToday
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {med.takenToday ? 'Taken' : 'Due at Night'}
                        </span>
                        {med.refillDaysLeft <= 7 && (
                          <span className="block text-[10px] text-rose-600 font-bold mt-1">
                            Refill in {med.refillDaysLeft}d
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upcoming Appointment Card */}
                {appointments[0] && (
                  <div className="mt-6 p-6 rounded-2xl bg-white border border-purple-200/80 shadow-xs space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Next Upcoming Doctor Consultation
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold">
                        Token #{appointments[0].tokenNumber}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{appointments[0].doctorName}</h3>
                        <p className="text-xs text-teal-700 font-semibold">{appointments[0].specialty}</p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-purple-600" />
                          <span>{appointments[0].hospital}</span>
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-sm font-bold text-slate-900 block">{appointments[0].date}</span>
                        <span className="text-xs text-teal-700 font-bold block">{appointments[0].time}</span>
                        <span className="text-[11px] text-slate-500 block mt-1">
                          Est. wait time: {appointments[0].queueWaitMins} mins
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Col: Latest Vitals At-a-Glance */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    <span>Latest Vitals</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowLogVitalModal(true)}
                    className="text-xs text-teal-700 font-bold hover:underline"
                  >
                    + Add New
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                  {vitals.slice(0, 4).map((vital) => (
                    <div key={vital.id} className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">{vital.type}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {vital.status}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-xl font-black text-slate-900">
                          {vital.value}{' '}
                          <span className="text-xs font-normal text-slate-500">{vital.unit}</span>
                        </span>
                        <span className="text-[10px] text-slate-400">{vital.recordedAt}</span>
                      </div>

                      <div className="text-[10px] text-slate-500 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                        <span>Target: {vital.targetRange}</span>
                        <span className="text-emerald-700 font-semibold">In Optimal Zone</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Link to Records */}
                <div
                  onClick={() => setActiveTab('records')}
                  className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 transition-all cursor-pointer flex items-center justify-between group shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-teal-700" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">View Complete Health Locker</span>
                      <span className="text-[11px] text-slate-500 block">5 documents available</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: HEALTH LOCKER & DOCUMENTS */}
        {activeTab === 'records' && (
          <div className="space-y-6">
            {/* Header & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-[#0D9488]" />
                  <span>Eka Health Locker · Medical Records</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Organized, OCR-scanned, and linked with ABHA for instant clinic sharing and AI summary.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-teal-700/20 transition-all cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>+ Upload Record</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {['All', 'Prescriptions', 'Lab Reports', 'Scans & Imaging', 'Vaccinations'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setRecordFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      recordFilter === cat
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by test, doctor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Records List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecords.map((record) => (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-400 transition-all cursor-pointer flex flex-col justify-between group shadow-xs hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                        {record.category}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">{record.date}</span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors leading-snug">
                        {record.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">{record.doctorOrLab}</p>
                    </div>

                    {/* AI Key Insights Box */}
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        AI Summary:
                      </span>
                      <p className="text-[11px] text-amber-950 line-clamp-3 leading-relaxed">
                        {record.aiKeySummary}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px] font-mono">
                      {record.fileType} · {record.fileSize}
                    </span>
                    <span className="text-teal-700 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>View Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: VITALS & HEALTH TRENDS */}
        {activeTab === 'vitals' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-emerald-600" />
                  <span>Vitals Logger &amp; Historical Trends</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Track cardiovascular and metabolic markers. Automatic alerts if readings deviate from target.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowLogVitalModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Log New Reading</span>
              </button>
            </div>

            {/* Vitals Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vitals.map((v) => (
                <div key={v.id} className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{v.type}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {v.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-2xl font-black text-slate-900">{v.value}</span>
                    <span className="text-xs text-slate-500 ml-1.5">{v.unit}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-600 text-[11px]">
                      <span>Target Band:</span>
                      <strong className="text-slate-900 font-bold">{v.targetRange}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Last Recorded:</span>
                      <span>{v.recordedAt}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Trend Explanation Box */}
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-emerald-900">
                  Clinical Trend Analysis (MiPAAS Agent 5 Aligned)
                </h4>
                <p className="text-xs text-emerald-950 mt-1 leading-relaxed">
                  Over the past 30 days, your fasting blood glucose and blood pressure have maintained stable
                  compliance with JNC-8 guidelines. No rapid fluctuations detected. Next routine HbA1c checkup
                  recommended in January 2027.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PRESCRIPTIONS & ACTIVE MEDS */}
        {activeTab === 'meds' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Pill className="w-6 h-6 text-[#0D9488]" />
                  <span>Active Medication Regimen &amp; Refills</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Digital prescription tracker with automated meal timing reminders and pharmacy refill alerts.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert('Prescription PDF download initiated.')}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold text-xs flex items-center gap-2 shadow-2xs transition-all"
                >
                  <Download className="w-4 h-4 text-teal-700" />
                  <span>Download Full Rx</span>
                </button>
              </div>
            </div>

            {/* Detailed Medications Table */}
            <div className="rounded-2xl bg-white border border-slate-200/90 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Medicine &amp; Dosage</th>
                      <th className="py-3.5 px-4">Daily Schedule</th>
                      <th className="py-3.5 px-4">Instructions</th>
                      <th className="py-3.5 px-4">Prescribed By</th>
                      <th className="py-3.5 px-4">Refill Status</th>
                      <th className="py-3.5 px-4 text-right">Today&apos;s Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medications.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-900">
                          <div>{m.name}</div>
                          <span className="text-[10px] font-normal text-slate-500">{m.dosage}</span>
                        </td>
                        <td className="py-4 px-4 text-slate-700">
                          <div>{m.frequency}</div>
                          <span className="text-[10px] text-teal-700 font-semibold">{m.timing} ({m.timeSlot})</span>
                        </td>
                        <td className="py-4 px-4 text-slate-700">{m.instruction}</td>
                        <td className="py-4 px-4 text-slate-700">{m.prescribedBy}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.refillDaysLeft <= 7
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {m.refillDaysLeft} days remaining
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => toggleMedication(m.id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                              m.takenToday
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-[#0D9488] text-white hover:bg-[#0F766E]'
                            }`}
                          >
                            {m.takenToday ? '✓ Taken' : 'Mark Taken'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: APPOINTMENTS & QUEUE */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-purple-700" />
                  <span>Doctor Consultations &amp; Live OPD Queue</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Manage hospital visits, view live clinic token wait times, and join video teleconsultations.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBookAptModal(true)}
                className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-purple-700/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Book Doctor Consult</span>
              </button>
            </div>

            <div className="space-y-4">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold">
                        {apt.type}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          apt.status === 'Cancelled'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500 font-medium">Live Clinic Token:</span>
                      <span className="px-3 py-1 rounded-lg bg-teal-50 text-teal-800 font-black text-sm border border-teal-200">
                        #{apt.tokenNumber}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{apt.doctorName}</h3>
                      <p className="text-xs text-teal-700 font-semibold">{apt.specialty}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{apt.hospital}</span>
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Scheduled Slot
                      </span>
                      <span className="text-sm font-bold text-slate-900 block mt-0.5">{apt.date}</span>
                      <span className="text-xs text-teal-700 font-bold">{apt.time}</span>
                    </div>

                    <div className="flex items-center justify-start md:justify-end gap-2.5">
                      {apt.type === 'Video Teleconsult' ? (
                        <button
                          type="button"
                          onClick={() => alert('Connecting to Eka Teleconsult Secure Room...')}
                          className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-700/20"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Video Call</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => alert('Navigating to clinic map directions...')}
                          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 text-teal-700" />
                          <span>Get Directions</span>
                        </button>
                      )}
                      {apt.status === 'Confirmed' && (
                        <button
                          type="button"
                          onClick={() => void handleCancelAppointment(apt.id)}
                          className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: ABHA DIGITAL CARD (AYUSHMAN BHARAT) */}
        {activeTab === 'abha' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <QrCode className="w-6 h-6 text-[#0D9488]" />
                <span>Ayushman Bharat Health Account (ABHA Card)</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Your official digital health identity under National Health Authority (NHA) &amp; ABDM.
              </p>
            </div>

            {/* ABHA Card Graphic Preview */}
            <div className="max-w-md mx-auto rounded-3xl bg-white border-2 border-teal-500 p-6 shadow-xl space-y-5 relative overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-[#0D9488] fill-[#0D9488]" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 block">
                      ABHA Digital Card
                    </span>
                    <span className="text-[9px] text-slate-500 block">National Health Authority</span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                  ABDM Verified
                </span>
              </div>

              {/* Card Body */}
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${activeProfile.avatarColor} flex items-center justify-center text-xl font-bold text-white shadow-md shrink-0 border-2 border-white`}
                >
                  {activeProfile.name[0]}
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">{activeProfile.name}</h3>
                  <div className="font-mono text-xs text-teal-700 font-black tracking-wide">
                    {activeProfile.abhaId}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    PHR: {activeProfile.name.toLowerCase().replace(' ', '')}@abdm
                  </div>
                </div>
              </div>

              {/* Card Details Grid */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[10px]">
                <div>
                  <span className="text-slate-500 block">Gender</span>
                  <strong className="text-slate-900">{activeProfile.gender}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Age</span>
                  <strong className="text-slate-900">{activeProfile.age} Years</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Blood Group</span>
                  <strong className="text-teal-700">{activeProfile.bloodGroup}</strong>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 bg-white rounded-lg p-1 flex items-center justify-center border border-slate-200">
                    <QrCode className="w-10 h-10 text-slate-900" />
                  </div>
                  <span className="text-[9px] text-slate-500 max-w-[140px] leading-tight">
                    Scan at clinic OPD registration desk for instant paperless token
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => alert('Official ABHA Card PDF downloading...')}
                  className="px-3.5 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-[10px] flex items-center gap-1 shadow-md shadow-teal-700/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Card</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: ASK AI DOCTOR (MEDITRON / SUPPORT AGENT) */}
        {activeTab === 'ai_chat' && (
          <div className="max-w-4xl mx-auto rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[640px]">
            {/* Chat Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-700 flex items-center justify-center text-white shadow-md shadow-purple-700/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Eka Health Assistant · MEDITRON AI</span>
                    <span className="px-2 py-0.2 rounded text-[10px] bg-purple-100 text-purple-800 font-semibold border border-purple-200">
                      MiPAAS Agent 9
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Ask questions about your reports, blood sugar, medication timings, or symptoms.
                  </p>
                </div>
              </div>

              <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                Locker Context Active
              </span>
            </div>

            {/* Chat Stream */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-white">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-purple-700 flex items-center justify-center text-white shrink-0 mt-1">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-lg p-4 rounded-2xl text-xs leading-relaxed space-y-1 ${
                      msg.sender === 'user'
                        ? 'bg-[#0D9488] text-white font-medium shadow-2xs'
                        : 'bg-slate-100 text-slate-800 border border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{renderChatText(msg.text)}</p>
                    <span
                      className={`text-[9px] block text-right ${
                        msg.sender === 'user' ? 'text-white/70' : 'text-slate-400'
                      }`}
                    >
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}

              {isAiThinking && (
                <div className="flex items-center gap-2 text-xs text-purple-700 italic">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>MEDITRON is reviewing your health records...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask about your lab tests, medicines, or tomorrow's consult..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-2xs"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isAiThinking}
                className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-purple-700/20"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </main>

      {/* MODAL 1: VIEW RECORD DETAILS DRAWER */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                  {selectedRecord.category}
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedRecord.title}</h2>
                <p className="text-xs text-slate-500">{selectedRecord.doctorOrLab} · {selectedRecord.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Smart Summary Card */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                OCR &amp; AI Key Findings
              </span>
              <p className="text-xs text-amber-950 leading-relaxed">{selectedRecord.aiKeySummary}</p>
            </div>

            {/* Extracted Lab Parameters Table */}
            {selectedRecord.extractedParameters && selectedRecord.extractedParameters.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Extracted Lab Values
                </h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Test Parameter</th>
                        <th className="py-2.5 px-3">Result</th>
                        <th className="py-2.5 px-3">Unit</th>
                        <th className="py-2.5 px-3 text-right">Clinical Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRecord.extractedParameters.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-medium text-slate-900">{p.name}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{p.value}</td>
                          <td className="py-2 px-3 text-slate-500">{p.unit}</td>
                          <td className="py-2 px-3 text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {p.flag}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => alert('Sharing consent link sent via ABHA SMS.')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center gap-2"
              >
                <Share2 className="w-4 h-4 text-teal-700" />
                <span>Share with Doctor via ABHA</span>
              </button>

              <button
                type="button"
                onClick={() => alert('Document downloaded to device.')}
                className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-teal-700/20"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF ({selectedRecord.fileSize})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: LOG NEW VITAL */}
      {showLogVitalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveVital}
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <span>Log Today&apos;s Vital Reading</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowLogVitalModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Vital Type:</label>
                <select
                  value={newVitalType}
                  onChange={(e) => {
                    setNewVitalType(e.target.value);
                    if (e.target.value === 'Blood Pressure') setNewVitalUnit('mmHg');
                    else if (e.target.value.includes('Sugar')) setNewVitalUnit('mg/dL');
                    else if (e.target.value === 'Heart Rate') setNewVitalUnit('BPM');
                    else if (e.target.value === 'SpO2') setNewVitalUnit('%');
                    else if (e.target.value.includes('Weight')) setNewVitalUnit('kg');
                    else setNewVitalUnit('°F');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-teal-500"
                >
                  <option value="Blood Pressure">Blood Pressure (e.g. 120/80)</option>
                  <option value="Blood Sugar (Fasting)">Blood Sugar (Fasting)</option>
                  <option value="Blood Sugar (PP)">Blood Sugar (Post-Prandial)</option>
                  <option value="Heart Rate">Heart Rate / Pulse</option>
                  <option value="SpO2">Oxygen Saturation (SpO2)</option>
                  <option value="Weight & BMI">Body Weight</option>
                  <option value="Body Temp">Body Temperature</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Recorded Value:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder={newVitalType === 'Blood Pressure' ? '120/80' : 'e.g. 104'}
                    value={newVitalValue}
                    onChange={(e) => setNewVitalValue(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-teal-500"
                  />
                  <span className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-mono">
                    {newVitalUnit}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogVitalModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingVital}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-700/20"
              >
                {savingVital ? 'Saving to MiPAAS…' : 'Save Reading'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: UPLOAD RECORD */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveRecord}
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#0D9488]" />
                <span>Upload to Eka Health Locker</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Drag Drop Area */}
              <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50 text-center space-y-2 cursor-pointer transition-colors">
                <UploadCloud className="w-8 h-8 text-teal-600 mx-auto" />
                <p className="text-slate-900 font-semibold">Drop PDF, JPG, or DICOM files here</p>
                <p className="text-[10px] text-slate-500">Up to 25MB · Encrypted with HIPAA &amp; ABDM standards</p>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Document Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Thyroid Profile & Ultrasound Report"
                  value={newRecTitle}
                  onChange={(e) => setNewRecTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Category:</label>
                <select
                  value={newRecCategory}
                  onChange={(e) => setNewRecCategory(e.target.value as HealthRecord['category'])}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-teal-500"
                >
                  <option value="Lab Reports">Lab Reports (Blood, Urine, Biopsy)</option>
                  <option value="Prescriptions">Prescriptions (Doctor Rx)</option>
                  <option value="Scans & Imaging">Scans &amp; Imaging (X-Ray, MRI, CT)</option>
                  <option value="Discharge Summary">Discharge Summary</option>
                  <option value="Vaccinations">Vaccination Certificate</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Doctor / Lab Name (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Rajesh / Max Diagnostic"
                  value={newRecDoctor}
                  onChange={(e) => setNewRecDoctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingRecord}
                className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-teal-700/20"
              >
                {savingRecord ? 'Encrypting & Analyzing…' : 'Upload & Analyze'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: BOOK APPOINTMENT */}
      {showBookAptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-700" />
                <span>Book Doctor Consultation</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBookAptModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Select Specialty / Doctor:</label>
                <select
                  value={bookDoctor}
                  onChange={(e) => setBookDoctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500"
                >
                  <option>Dr. Anurag Verma · Cardiology</option>
                  <option>Dr. Meera Nambiar · General Medicine</option>
                  <option>Dr. S. K. Gupta · Pulmonology / Chest</option>
                  <option>Dr. Ananya Ray · Endocrinology (Diabetes)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Consultation Mode:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBookMode('In-Clinic')}
                    className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition-colors ${
                      bookMode === 'In-Clinic'
                        ? 'border-purple-600 bg-purple-50 text-purple-900'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-semibold'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-purple-700" />
                    <span>In-Clinic OPD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookMode('Video Teleconsult')}
                    className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition-colors ${
                      bookMode === 'Video Teleconsult'
                        ? 'border-purple-600 bg-purple-50 text-purple-900'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-semibold'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 text-teal-600" />
                    <span>Video Teleconsult</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Preferred Date &amp; Slot:</label>
                <input
                  type="date"
                  value={bookDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setBookDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBookAptModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBooking}
                onClick={() => void handleBookAppointment()}
                className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-purple-700/20"
              >
                {isBooking ? 'Reserving Token…' : 'Confirm Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
