'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRBAC } from '@/context/RBACContext';
import {
  Users,
  FileText,
  Calendar,
  ShieldCheck,
  Search,
  Plus,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Copy,
  RefreshCw,
  Stethoscope,
  HeartPulse,
  ChevronRight,
  ChevronDown,
  Activity,
  Check,
  X,
  Pill,
  ShieldAlert,
  Send,
  Building2,
  Lock,
  MessageSquare,
  Settings,
  Bell,
  Home,
  Heart,
  Wind,
  Scale,
  Target,
  FlaskConical,
  Circle,
  Download,
  Share2,
  Phone,
  Mail,
  MapPin,
  Eye,
  Video,
  FileCheck,
  CreditCard,
  QrCode,
  Syringe,
  Smile,
  HelpCircle
} from 'lucide-react';

interface PatientProfile {
  id: string;
  name: string;
  dob: string;
  age: number;
  gender: string;
  bloodType: string;
  mrn: string;
  email: string;
  phone: string;
  address: string;
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };
  insurance: {
    provider: string;
    plan: string;
    memberId: string;
    groupNumber: string;
    validThru: string;
  };
  primaryDoctor: {
    name: string;
    title: string;
    clinic: string;
    phone: string;
  };
}

const CURRENT_PATIENT: PatientProfile = {
  id: 'pat_alex_01',
  name: 'Alex Taylor',
  dob: 'June 14, 1988',
  age: 38,
  gender: 'Female',
  bloodType: 'O Positive (O+)',
  mrn: 'CN-8842-1001',
  email: 'alex.taylor@carenest.health',
  phone: '(555) 014-2901',
  address: '42 Abbey Road, Apt 4B, Boston, MA 02115',
  emergencyContact: {
    name: 'David Taylor',
    relation: 'Spouse',
    phone: '(555) 014-8892',
  },
  insurance: {
    provider: 'CareNest Premier Healthcare',
    plan: 'Comprehensive Care PPO Plus',
    memberId: 'CN-99201-884',
    groupNumber: 'GRP-77120',
    validThru: '12/2027',
  },
  primaryDoctor: {
    name: 'Dr. Taylor, MD',
    title: 'Lead Pulmonologist & Primary Physician',
    clinic: 'CareNest Medical Center · Suite 402',
    phone: '(555) 019-3000',
  },
};

export default function OpenEMRHub() {
  const { currentUser, switchPersona } = useRBAC();
  const isPatient = currentUser?.role === 'patient';

  // Navigation tabs matching CareNest layout:
  // Overview, Appointments, Health Records, Medications, Test Results, Messages, Settings
  const [activeTab, setActiveTab] = useState<
    'overview' | 'appointments' | 'records' | 'medications' | 'results' | 'messages' | 'settings'
  >('overview');

  const patient = CURRENT_PATIENT;
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Health Records Sub-Tab for patient exploration
  const [recordsTab, setRecordsTab] = useState<'visits' | 'conditions' | 'vaccines' | 'vitals_history'>('visits');

  // Care Plan Checklist State (Interactive & Clickable)
  const [carePlanTasks, setCarePlanTasks] = useState([
    {
      id: 'task-1',
      title: 'Review medication schedule',
      subtitle: 'Stay on track with your morning inhaler & blood pressure medication.',
      completed: true,
      actionTab: 'medications' as const,
    },
    {
      id: 'task-2',
      title: 'Prepare for upcoming visit',
      subtitle: 'Check appointment notes and list any recent symptoms for Dr. Taylor.',
      completed: true,
      actionTab: 'appointments' as const,
    },
    {
      id: 'task-3',
      title: 'Read your latest test results',
      subtitle: 'Your recent blood work and lung screening are ready for review.',
      completed: false,
      actionTab: 'results' as const,
    },
  ]);

  // Appointments State
  const [appointments, setAppointments] = useState([
    {
      id: 'apt-01',
      doctor: 'Dr. Taylor',
      specialty: 'Pulmonology & Preventive Medicine',
      date: 'Tue, 20 Oct',
      time: '10:30 AM',
      type: 'In-Clinic Consultation',
      location: 'Suite 402 · CareNest Medical Center',
      status: 'Confirmed',
      instructions: 'Please arrive 10 minutes early. No fasting required.',
    },
    {
      id: 'apt-02',
      doctor: 'Dr. Elena Vance, MD',
      specialty: 'Diagnostic Radiology Review',
      date: 'Thu, 05 Nov',
      time: '02:15 PM',
      type: 'Teleconsult Video Visit',
      location: 'CareNest Secure Video Link',
      status: 'Upcoming',
      instructions: 'Have your phone or laptop camera ready. Link activates 15 min prior.',
    },
  ]);

  // Past Visits History for Health Records
  const [pastVisits, setPastVisits] = useState([
    {
      id: 'visit-01',
      date: 'September 12, 2026',
      doctor: 'Dr. Taylor',
      specialty: 'Pulmonology',
      reason: 'Routine Pulmonary Follow-up & Medication Review',
      doctorSummary:
        'Lungs are clear bilaterally. Airway flow tests showed a +6% improvement following consistent use of Tiotropium. Blood pressure is well-controlled at 124/80. Advised to continue current routine.',
      prescriptionsUpdated: ['Albuterol Inhaler (Renewed)', 'Tiotropium 18mcg Daily'],
      vitalsRecorded: 'BP: 124/80 mmHg · Pulse: 72 bpm · SpO2: 98%',
    },
    {
      id: 'visit-02',
      date: 'June 04, 2026',
      doctor: 'Dr. Marcus Chen',
      specialty: 'Cardiology Baseline',
      reason: 'Preventive Cardiovascular & Blood Pressure Screening',
      doctorSummary:
        'ECG normal sinus rhythm without ischemic changes. Heart sounds S1/S2 normal without murmur. Advised continuing low-sodium diet and maintaining 30 minutes of light daily walking.',
      prescriptionsUpdated: ['Lisinopril 10mg PO Daily'],
      vitalsRecorded: 'BP: 128/82 mmHg · Pulse: 74 bpm · BMI: 25.4',
    },
  ]);

  // Active Medications
  const [medications, setMedications] = useState([
    {
      id: 'med-1',
      name: 'Albuterol Sulfate Inhaler',
      dosage: '90 mcg per actuation',
      instructions: 'Inhale 2 puffs every 4 to 6 hours as needed for shortness of breath.',
      prescribedBy: 'Dr. Taylor',
      refillsLeft: 3,
      adherence: '98%',
      status: 'Active',
      tag: 'Morning / As Needed',
    },
    {
      id: 'med-2',
      name: 'Tiotropium Bromide (Spiriva)',
      dosage: '18 mcg capsule',
      instructions: 'Inhale 1 capsule daily in the morning with your inhaler device.',
      prescribedBy: 'Dr. Taylor',
      refillsLeft: 2,
      adherence: '100%',
      status: 'Active',
      tag: 'Daily Maintenance',
    },
    {
      id: 'med-3',
      name: 'Lisinopril',
      dosage: '10 mg oral tablet',
      instructions: 'Take 1 tablet by mouth daily with a glass of water.',
      prescribedBy: 'Dr. Marcus Chen',
      refillsLeft: 4,
      adherence: '100%',
      status: 'Active',
      tag: 'Blood Pressure',
    },
  ]);

  // Test Results
  const [testResults, setTestResults] = useState([
    {
      id: 'res-1',
      title: 'Comprehensive Metabolic & Blood Panel',
      date: 'Today, 9:12 AM',
      category: 'Lab Work',
      orderedBy: 'Dr. Taylor',
      status: 'Normal & Stable',
      patientExplanation:
        'All your kidney, liver, electrolyte, and blood sugar levels are within the healthy normal range. No action required.',
      details: [
        { test: 'Fasting Blood Glucose', value: '92 mg/dL', status: 'Optimal (70 - 99)' },
        { test: 'Serum Creatinine', value: '0.88 mg/dL', status: 'Normal (0.6 - 1.1)' },
        { test: 'Sodium', value: '140 mEq/L', status: 'Normal (136 - 145)' },
        { test: 'Potassium', value: '4.2 mEq/L', status: 'Normal (3.5 - 5.0)' },
      ],
    },
    {
      id: 'res-2',
      title: 'Annual Low-Dose Chest CT Scan',
      date: 'October 12, 2026',
      category: 'Diagnostic Radiology',
      orderedBy: 'Dr. Taylor',
      status: 'Doctor Reviewed · Stable',
      patientExplanation:
        'Your lung scan shows healthy lung volume with no acute pneumonia or alarming changes. The small benign apical nodule remains stable and non-progressive. Your next routine screening is in 12 months.',
      details: [
        { test: 'Scan Modality', value: 'Low-Dose Chest CT', status: 'Completed' },
        { test: 'Finding Classification', value: 'Lung-RADS 2 (Benign Appearance)', status: 'Stable' },
        { test: 'Next Surveillance', value: 'Annual (October 2027)', status: 'On Schedule' },
      ],
    },
  ]);

  // Messages State
  const [messages, setMessages] = useState([
    {
      id: 'msg-1',
      sender: 'Dr. Taylor',
      role: 'Your Doctor',
      avatarColor: 'bg-teal-500',
      time: 'Yesterday, 3:45 PM',
      text: "Hello Alex, your latest blood panel came back with all markers in the normal range! Please continue taking your Lisinopril and inhaler as scheduled, and we'll review your pulmonary scan on Tuesday.",
      isMe: false,
    },
    {
      id: 'msg-2',
      sender: 'Nurse Sarah',
      role: 'Care Coordinator',
      avatarColor: 'bg-sky-500',
      time: 'Today, 9:20 AM',
      text: 'Good morning Alex! Just a quick reminder that fasting is NOT needed for your visit on Tuesday at 10:30 AM. Feel free to message here if you have any questions before then.',
      isMe: false,
    },
  ]);
  const [newMessageText, setNewMessageText] = useState('');

  // Modals & Booking
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [newAppointmentForm, setNewAppointmentForm] = useState({
    doctor: 'Dr. Taylor',
    date: '2026-10-22',
    time: '11:00 AM',
    type: 'In-Clinic Consultation',
    reason: 'Routine health checkup',
  });

  // Settings: Notification & Privacy Preferences
  const [notificationSettings, setNotificationSettings] = useState({
    smsReminders: true,
    emailLabResults: true,
    doctorMessageAlerts: true,
    medicationRefillPushes: true,
  });

  const toggleTaskCompleted = (taskId: string) => {
    setCarePlanTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const completedTaskCount = carePlanTasks.filter((t) => t.completed).length;
  const taskProgressPct = Math.round((completedTaskCount / carePlanTasks.length) * 100);

  const handleBookAppointmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newApt = {
      id: `apt-${Date.now().toString().slice(-3)}`,
      doctor: newAppointmentForm.doctor,
      specialty: 'Clinical Consultation',
      date: newAppointmentForm.date,
      time: newAppointmentForm.time,
      type: newAppointmentForm.type,
      location: 'CareNest Medical Center · Suite 402',
      status: 'Confirmed',
      instructions: 'Appointment booked successfully. We will send an SMS reminder 24 hours prior.',
    };
    setAppointments([newApt, ...appointments]);
    setShowAppointmentModal(false);
    setNotification(`Appointment booked with ${newApt.doctor} for ${newApt.date} at ${newApt.time}!`);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: `${patient.name} (You)`,
      role: 'Patient',
      avatarColor: 'bg-[#17324D]',
      time: 'Just now',
      text: newMessageText,
      isMe: true,
    };
    setMessages([...messages, newMsg]);
    setNewMessageText('');
    setNotification('Message sent to your care team.');
    setTimeout(() => setNotification(null), 3000);
  };

  // SVG Arch Gauge Meter Component
  const renderSemiCircleGauge = (
    label: string,
    value: string,
    unit: string,
    icon: React.ReactNode,
    color: string,
    progress: number,
    badgeText = 'Normal range'
  ) => {
    const radius = 48;
    const circumference = Math.PI * radius; // ~150.8
    const strokeDashoffset = circumference * (1 - Math.min(Math.max(progress, 0.1), 0.95));

    return (
      <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-white border border-[#E7EEF4] hover:shadow-md transition-all">
        <span className="text-xs font-medium text-slate-500 mb-2">{label}</span>
        
        {/* SVG Semi-Circle Arch Meter */}
        <div className="relative w-32 h-20 flex items-center justify-center">
          <svg className="w-32 h-20 overflow-visible" viewBox="0 0 120 70">
            {/* Background Arch */}
            <path
              d="M 12,65 A 48,48 0 0,1 108,65"
              fill="none"
              stroke="#EDF3F8"
              strokeWidth="9"
              strokeLinecap="round"
            />
            {/* Value Indicator Arch */}
            <path
              d="M 12,65 A 48,48 0 0,1 108,65"
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Centered Icon inside the arch */}
          <div className="absolute top-5 flex items-center justify-center w-8 h-8 rounded-full" style={{ color }}>
            {icon}
          </div>
        </div>

        {/* Large Value & Unit */}
        <div className="mt-1 text-center">
          <div className="text-xl sm:text-2xl font-bold text-[#17324D] tracking-tight">
            {value}
          </div>
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider -mt-0.5">
            {unit}
          </div>
        </div>

        {/* Reference Range Status Badge */}
        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E8F8F5] text-[#0F9D9A] text-[11px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0F9D9A]" />
          <span>{badgeText}</span>
        </div>
      </div>
    );
  };

  // ==============================================================
  // PATIENT AUTHORIZATION GATE (Strictly Patient-Owned Access)
  // ==============================================================
  if (!isPatient) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] font-sans flex items-center justify-center p-4 antialiased">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-[#E7EEF4] text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-[#0F9D9A] mx-auto flex items-center justify-center shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold uppercase tracking-wider">
              Patient Access Only
            </span>
            <h2 className="text-2xl font-extrabold text-[#17324D] mt-2">
              Alex Taylor&apos;s Private Portal
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              You are currently signed in as{' '}
              <strong className="text-slate-700">{currentUser?.name || 'Guest'}</strong> ({currentUser?.role}).
              This personal health portal is restricted exclusively to patient <strong>Alex Taylor</strong>.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => switchPersona('pat-01')}
              className="w-full py-3 px-4 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Heart className="w-4 h-4 fill-white" />
              <span>Sign In as Alex Taylor (Patient)</span>
            </button>

            <Link
              href="/doctor"
              className="w-full py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-[#17324D] border border-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              <Stethoscope className="w-4 h-4 text-[#0F9D9A]" />
              <span>Go to Doctor Portal (Dr. Elena Vance)</span>
            </Link>

            <Link
              href="/"
              className="block text-xs text-slate-400 hover:text-slate-600 font-medium pt-2"
            >
              Return to MiPAAS Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F9FC] font-sans text-slate-800 flex flex-col antialiased">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-[#17324D] text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-xl shadow-xl border border-teal-500/30 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-4 h-4 text-[#0F9D9A]" />
          <span>{notification}</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ==============================================================
            LEFT SIDEBAR NAVIGATION (Patient Portal)
           ============================================================== */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#E7EEF4] flex flex-col justify-between transition-transform duration-300 lg:static lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          <div>
            {/* Brand Logo matching reference */}
            <div className="h-20 px-6 flex items-center justify-between border-b border-[#F0F4F8]">
              <Link href="/emr" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0F9D9A] to-[#2DD4BF] flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                  <Heart className="w-5 h-5 fill-white/20" />
                </div>
                <span className="text-lg font-extrabold text-[#17324D] tracking-tight">
                  Patient Portal
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Menu */}
            <nav className="p-4 space-y-1.5">
              {[
                { id: 'overview', label: 'Overview', icon: Home, dot: false },
                { id: 'appointments', label: 'Appointments', icon: Calendar, dot: false },
                { id: 'records', label: 'Health Records', icon: FileText, dot: false },
                { id: 'medications', label: 'Medications', icon: Pill, dot: false },
                { id: 'results', label: 'Test Results', icon: FlaskConical, dot: false },
                { id: 'messages', label: 'Messages', icon: MessageSquare, dot: true },
                { id: 'settings', label: 'Settings', icon: Settings, dot: false },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id as typeof activeTab);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#E6F7F7] text-[#0F9D9A] font-semibold shadow-xs'
                        : 'text-slate-600 hover:bg-[#F5F9FC] hover:text-[#17324D]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-[#0F9D9A]' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.dot && (
                      <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Card: "Your health matters" matching screenshot */}
          <div className="p-4 m-4 rounded-2xl bg-gradient-to-br from-[#E8F8F5] via-[#EBF4FA] to-[#F3EFFC] border border-white/60 shadow-xs">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-teal-600 shadow-xs shrink-0">
                <HeartPulse className="w-5 h-5 text-[#0F9D9A]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#17324D]">Your health matters</h4>
                <p className="text-[11px] text-slate-500 leading-tight">We&apos;re here to support you, always.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('messages')}
              className="w-full mt-2 py-1.5 px-3 rounded-lg bg-white/80 hover:bg-white text-xs font-semibold text-[#0F9D9A] border border-teal-500/20 transition-all text-center cursor-pointer"
            >
              Contact Care Team
            </button>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* ==============================================================
            MAIN DASHBOARD AREA
           ============================================================== */}
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
          {/* Top Header */}
          <header className="sticky top-0 z-20 h-20 bg-white/90 backdrop-blur-md border-b border-[#E7EEF4] px-4 sm:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200"
                aria-label="Open navigation menu"
              >
                <Users className="w-5 h-5" />
              </button>

              {/* Patient Search Input */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search records or help..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F7FAFD] border border-[#E2EBF2] text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0F9D9A] focus:ring-2 focus:ring-[#0F9D9A]/15 transition-all"
                />
              </div>
            </div>

            {/* Header Right Actions: Notifications & Personal Profile */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Notification Bell */}
              <button
                type="button"
                onClick={() => {
                  setNotification('You have 2 unread messages and 1 upcoming visit reminder.');
                  setTimeout(() => setNotification(null), 3000);
                }}
                className="relative p-2.5 rounded-xl bg-[#F7FAFD] border border-[#E2EBF2] text-slate-600 hover:text-[#0F9D9A] transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF7869] ring-2 ring-white" />
              </button>

              {/* Patient Profile Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-[#F7FAFD] hover:bg-[#EEF5FA] border border-[#E2EBF2] transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-sky-400 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                    {patient.name.charAt(0)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-bold text-[#17324D] leading-tight">
                      {patient.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">Patient</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Patient Profile Dropdown */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-[#E7EEF4] shadow-xl p-3 z-30 animate-in fade-in duration-150 text-xs">
                    <div className="flex items-center gap-3 p-2 bg-[#F8FAFD] rounded-xl mb-2">
                      <div className="w-10 h-10 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-[#17324D]">{patient.name}</div>
                        <div className="text-slate-400 text-[11px]">MRN: {patient.mrn}</div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowInsuranceModal(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4 text-[#0F9D9A]" />
                        <span>View My Digital Insurance Card</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowShareModal(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        <Share2 className="w-4 h-4 text-[#0F9D9A]" />
                        <span>Share My Health Records</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setActiveTab('settings');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-[#0F9D9A]" />
                        <span>Notification &amp; Privacy Settings</span>
                      </button>
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-100">
                      <Link
                        href="/"
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-slate-400 hover:text-slate-600 font-semibold text-[11px]"
                      >
                        <span>Return to Main MiPAAS Site</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Workspace */}
          <main className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* ==============================================================
                TAB 1: OVERVIEW (Faithful to Reference Image)
               ============================================================== */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 1. Welcome Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17324D] tracking-tight flex items-center gap-2">
                      <span>Good morning, {patient.name.split(' ')[0]}</span>
                      <span className="text-2xl">☀️</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Here&apos;s your health overview for today.
                    </p>
                  </div>

                  {/* Prominent Action Buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAppointmentModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Book appointment</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('records')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D5E2EC] text-[#17324D] font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-[#0F9D9A]" />
                      <span>View health records</span>
                    </button>
                  </div>
                </div>

                {/* 2. Medical Alerts & Allergies (Patient Safety) */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 flex items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                        My Known Drug Allergies:
                      </span>
                      <div className="text-xs text-amber-900 font-semibold flex flex-wrap gap-2 mt-0.5">
                        <span className="px-2 py-0.5 rounded-md bg-amber-100">Penicillin (Severe)</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-100">IV Iodine Contrast (Moderate)</span>
                      </div>
                    </div>
                  </div>
                  <span className="hidden md:inline-flex text-[11px] font-semibold text-amber-700 shrink-0">
                    Shared with care team for all visits
                  </span>
                </div>

                {/* 3. Four Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Next appointment */}
                  <div
                    onClick={() => setActiveTab('appointments')}
                    className="p-4 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs hover:shadow-md transition-all flex items-start gap-3.5 cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#EBF3FE] text-[#2563EB] flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-500">Next appointment</div>
                      <div className="text-sm font-bold text-[#17324D] mt-0.5 truncate">
                        Tue, 20 Oct · 10:30 AM
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {patient.primaryDoctor.name}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Medications */}
                  <div
                    onClick={() => setActiveTab('medications')}
                    className="p-4 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs hover:shadow-md transition-all flex items-start gap-3.5 cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#EAF8F2] text-[#10B981] flex items-center justify-center shrink-0">
                      <Pill className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-500">Medications</div>
                      <div className="text-sm font-bold text-[#17324D] mt-0.5 flex items-center justify-between">
                        <span>3 active</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <span className="text-xs font-semibold text-[#0F9D9A] mt-0.5 inline-block">
                        View schedule
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Recent test results */}
                  <div
                    onClick={() => setActiveTab('results')}
                    className="p-4 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs hover:shadow-md transition-all flex items-start gap-3.5 cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#F2EDFC] text-[#8B5CF6] flex items-center justify-center shrink-0">
                      <FlaskConical className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-500">Recent test results</div>
                      <div className="text-sm font-bold text-[#17324D] mt-0.5 flex items-center justify-between">
                        <span>2 new</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <span className="text-xs font-semibold text-[#0F9D9A] mt-0.5 inline-block">
                        View results
                      </span>
                    </div>
                  </div>

                  {/* Card 4: Care team */}
                  <div
                    onClick={() => setActiveTab('messages')}
                    className="p-4 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs hover:shadow-md transition-all flex items-start gap-3.5 cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#FDF3EB] text-[#F97316] flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-500">Care team</div>
                      <div className="text-sm font-bold text-[#17324D] mt-0.5 flex items-center justify-between">
                        <span>Available to help</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <span className="text-xs font-semibold text-[#0F9D9A] mt-0.5 inline-block">
                        Send a message
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Two-Column Middle Section: "Your health at a glance" & "Your care plan" */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column (8 cols): Health at a Glance */}
                  <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E7EEF4] p-5 sm:p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-[#E8F8F5] text-[#0F9D9A]">
                          <HeartPulse className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-base sm:text-lg font-bold text-[#17324D]">
                            Your health at a glance
                          </h2>
                          <p className="text-xs text-slate-400">
                            Your latest vital signs and measurements.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('records');
                          setRecordsTab('vitals_history');
                        }}
                        className="text-xs font-bold text-[#0F9D9A] hover:text-[#0D8B88] flex items-center gap-1 cursor-pointer"
                      >
                        <span>View details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 4 Gauge Meters matching screenshot */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 mt-4">
                      {/* Blood Pressure */}
                      {renderSemiCircleGauge(
                        'Blood pressure',
                        '128/82',
                        'mmHg',
                        <Stethoscope className="w-4 h-4" />,
                        '#3B82F6',
                        0.68,
                        'Normal range'
                      )}

                      {/* Heart Rate */}
                      {renderSemiCircleGauge(
                        'Heart rate',
                        '74',
                        'bpm',
                        <Heart className="w-4 h-4" />,
                        '#EF4444',
                        0.72,
                        'Normal range'
                      )}

                      {/* Oxygen */}
                      {renderSemiCircleGauge(
                        'Oxygen',
                        '98',
                        '%',
                        <Wind className="w-4 h-4" />,
                        '#0F9D9A',
                        0.96,
                        'Normal range'
                      )}

                      {/* BMI */}
                      {renderSemiCircleGauge(
                        'BMI',
                        '25.4',
                        'kg/m²',
                        <Scale className="w-4 h-4" />,
                        '#10B981',
                        0.62,
                        'Normal range'
                      )}
                    </div>
                  </div>

                  {/* Right Column (5 cols): Your Care Plan */}
                  <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E7EEF4] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-[#0F9D9A]" />
                          <h2 className="text-base sm:text-lg font-bold text-[#17324D]">
                            Your care plan
                          </h2>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">
                          {completedTaskCount} of {carePlanTasks.length} completed
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-[#EDF3F8] overflow-hidden my-3">
                        <div
                          className="h-full rounded-full bg-[#0F9D9A] transition-all duration-500 ease-out"
                          style={{ width: `${taskProgressPct}%` }}
                        />
                      </div>

                      {/* Interactive Checklist */}
                      <div className="space-y-3 mt-4">
                        {carePlanTasks.map((task) => (
                          <div
                            key={task.id}
                            className={`p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                              task.completed
                                ? 'bg-white border-[#E7EEF4]'
                                : 'bg-slate-50/70 border-slate-200'
                            }`}
                            onClick={() => toggleTaskCompleted(task.id)}
                          >
                            <button
                              type="button"
                              className="mt-0.5 text-teal-600 focus:outline-none cursor-pointer"
                              aria-label={task.completed ? 'Mark task pending' : 'Mark task completed'}
                            >
                              {task.completed ? (
                                <CheckCircle2 className="w-5 h-5 fill-[#0F9D9A] text-white" />
                              ) : (
                                <Circle className="w-5 h-5 text-slate-300" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-xs sm:text-sm font-bold ${
                                  task.completed ? 'text-[#17324D]' : 'text-slate-700'
                                }`}
                              >
                                {task.title}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5 leading-snug">
                                {task.subtitle}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('records')}
                      className="mt-4 w-full py-2 rounded-xl bg-[#F7FAFD] hover:bg-[#EEF5FA] text-xs font-semibold text-[#0F9D9A] border border-[#E2EBF2] transition-colors text-center cursor-pointer"
                    >
                      View Full Care Plan &amp; Guidance
                    </button>
                  </div>
                </div>

                {/* 5. Recent Activity Section */}
                <div className="bg-white rounded-2xl border border-[#E7EEF4] p-5 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F0F4F8]">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#17324D]" />
                      <h2 className="text-base sm:text-lg font-bold text-[#17324D]">
                        Recent activity
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('results')}
                      className="text-xs font-bold text-[#0F9D9A] hover:text-[#0D8B88] flex items-center gap-1 cursor-pointer"
                    >
                      <span>View all</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Item 1: Lab results */}
                    <div
                      onClick={() => setActiveTab('results')}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F8FAFD] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-full bg-[#F2EDFC] text-[#8B5CF6] flex items-center justify-center shrink-0">
                          <FlaskConical className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#17324D] group-hover:text-[#0F9D9A] transition-colors">
                            Lab results added
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Your blood test results have been added to your health records.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-medium text-slate-400">Today, 9:12 AM</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>

                    {/* Item 2: Appointment reminder */}
                    <div
                      onClick={() => setActiveTab('appointments')}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F8FAFD] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-full bg-[#EBF3FE] text-[#2563EB] flex items-center justify-center shrink-0">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#17324D] group-hover:text-[#0F9D9A] transition-colors">
                            Appointment reminder
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            You have an upcoming appointment with Dr. Taylor on Tue, 20 Oct at 10:30 AM.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-medium text-slate-400">Yesterday, 4:30 PM</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 2: APPOINTMENTS (Patient Centered)
               ============================================================== */}
            {activeTab === 'appointments' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#17324D]">My Appointments</h2>
                    <p className="text-sm text-slate-500">View upcoming clinical consultations and book new visits.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAppointmentModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule New Appointment</span>
                  </button>
                </div>

                {/* Upcoming Appointments List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#E8F8F5] text-[#0F9D9A] text-[11px] font-bold mb-1">
                            {apt.status}
                          </span>
                          <h3 className="text-base font-bold text-[#17324D]">{apt.doctor}</h3>
                          <p className="text-xs text-slate-400">{apt.specialty}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-teal-50 text-[#0F9D9A]">
                          <Calendar className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2] text-xs space-y-2 text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Date &amp; Time:</span>
                          <span className="font-bold text-[#17324D]">{apt.date} at {apt.time}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Location:</span>
                          <span className="font-medium text-slate-700">{apt.location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Type:</span>
                          <span className="font-medium text-slate-700">{apt.type}</span>
                        </div>
                        <div className="pt-1 text-[11px] text-teal-800 bg-teal-50/70 p-2 rounded-lg">
                          💡 {apt.instructions}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setNotification(`Calendar invite added for your visit with ${apt.doctor}`);
                            setTimeout(() => setNotification(null), 3000);
                          }}
                          className="flex-1 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#D5E2EC] text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                        >
                          Add to Calendar
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('messages')}
                          className="flex-1 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-xs font-semibold text-white transition-colors cursor-pointer"
                        >
                          Message Doctor
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Helpful Clinic Tips Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-50/70 to-sky-50/70 border border-teal-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-white text-[#0F9D9A] flex items-center justify-center shadow-xs">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#17324D]">Need to reschedule or cancel?</h4>
                      <p className="text-xs text-slate-500">
                        You can reschedule up to 2 hours before your visit without any cancellation fees.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('messages')}
                    className="px-3.5 py-1.5 rounded-xl bg-white text-xs font-semibold text-[#0F9D9A] border border-teal-200 hover:bg-teal-50 cursor-pointer shrink-0"
                  >
                    Contact Support
                  </button>
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 3: HEALTH RECORDS (Patient Interactive & Visual)
               ============================================================== */}
            {activeTab === 'records' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#17324D]">My Health Records</h2>
                    <p className="text-sm text-slate-500">Explore past doctor summaries, vitals history, vaccines, and health documents.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#D5E2EC] text-xs font-semibold text-[#17324D] shadow-xs cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#0F9D9A]" />
                      <span>Share Records</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInsuranceModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Insurance Card</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Tabs for clean patient navigation */}
                <div className="flex items-center gap-2 p-1 bg-white rounded-xl border border-[#E7EEF4] w-fit">
                  {[
                    { id: 'visits', label: 'Doctor Visits & Summaries' },
                    { id: 'conditions', label: 'Conditions & Allergies' },
                    { id: 'vaccines', label: 'Vaccines & Immunizations' },
                    { id: 'vitals_history', label: 'Vitals Log' },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setRecordsTab(sub.id as typeof recordsTab)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        recordsTab === sub.id
                          ? 'bg-[#E6F7F7] text-[#0F9D9A] shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* Sub-View 1: Past Doctor Visits & Summaries */}
                {recordsTab === 'visits' && (
                  <div className="space-y-4">
                    {pastVisits.map((visit) => (
                      <div key={visit.id} className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div>
                            <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">
                              Completed Consultation
                            </span>
                            <h3 className="text-base font-bold text-[#17324D] mt-1">{visit.reason}</h3>
                            <p className="text-xs text-slate-400">
                              {visit.doctor} ({visit.specialty}) · {visit.date}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setNotification(`Downloaded visit summary PDF for ${visit.date}`);
                              setTimeout(() => setNotification(null), 3000);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 self-start sm:self-center cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>Download Visit Note</span>
                          </button>
                        </div>

                        {/* Doctor's Plain English Takeaway */}
                        <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2] space-y-1.5">
                          <span className="text-xs font-bold text-[#17324D] flex items-center gap-1.5">
                            <Stethoscope className="w-4 h-4 text-[#0F9D9A]" />
                            <span>Doctor&apos;s Summary &amp; Recommendations:</span>
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {visit.doctorSummary}
                          </p>
                        </div>

                        {/* Prescriptions & Vitals recorded */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                          <div className="p-2.5 rounded-lg bg-white border border-slate-100 text-slate-600">
                            <span className="text-[11px] font-bold text-slate-400 block mb-1">Medications Reviewed:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {visit.prescriptionsUpdated.map((p, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[11px]">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border border-slate-100 text-slate-600">
                            <span className="text-[11px] font-bold text-slate-400 block mb-1">Vitals on Record:</span>
                            <span className="font-medium text-slate-700">{visit.vitalsRecorded}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sub-View 2: Conditions & Allergies */}
                {recordsTab === 'conditions' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Allergies Card */}
                    <div className="bg-white rounded-2xl border border-[#E7EEF4] p-5 shadow-xs space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[#17324D]">My Allergies</h3>
                          <p className="text-xs text-slate-400">Important substances to avoid.</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-amber-950">Penicillin &amp; Beta-Lactams</span>
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                              Severe Reaction
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-900 leading-relaxed">
                            Reaction: Anaphylactoid hives and throat tightness. Alternative antibiotics (Azithromycin, Doxycycline) are documented in your chart.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-amber-950">IV Iodine Contrast Dye</span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              Moderate Reaction
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-900 leading-relaxed">
                            Reaction: Pruritus (itching). Any contrast CT scans will receive standard oral steroid/Benadryl premedication.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Conditions Card */}
                    <div className="bg-white rounded-2xl border border-[#E7EEF4] p-5 shadow-xs space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-teal-50 text-[#0F9D9A]">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[#17324D]">Chronic Conditions Monitored</h3>
                          <p className="text-xs text-slate-400">Ongoing health conditions under management.</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl border border-[#E2EBF2] bg-[#F8FAFD] space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-[#17324D]">COPD (Mild / Stable)</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                              Controlled
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Annual lung CT screening and daily Tiotropium maintenance maintain healthy baseline oxygen levels (98%).
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl border border-[#E2EBF2] bg-[#F8FAFD] space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-[#17324D]">Primary Hypertension</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                              Target Met (128/82)
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Controlled with daily Lisinopril 10mg and regular home blood pressure monitoring.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-View 3: Vaccines & Immunizations */}
                {recordsTab === 'vaccines' && (
                  <div className="bg-white rounded-2xl border border-[#E7EEF4] p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-teal-50 text-[#0F9D9A]">
                          <Syringe className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[#17324D]">My Immunization Records</h3>
                          <p className="text-xs text-slate-400">Vaccines on file with state registry &amp; CareNest.</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                        Up to date
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                      {[
                        { name: 'Influenza (Seasonal Flu Vaccine)', date: 'September 28, 2026', clinic: 'CareNest Health Suite', renewal: 'September 2027' },
                        { name: 'COVID-19 Updated Booster (mRNA)', date: 'October 02, 2025', clinic: 'CVS Pharmacy #02115', renewal: 'Optional Fall 2027' },
                        { name: 'Tdap (Tetanus, Diphtheria, Pertussis)', date: 'August 14, 2020', clinic: 'Mass General Brigham', renewal: 'August 2030' },
                        { name: 'Pneumococcal Conjugate (PCV20)', date: 'March 11, 2024', clinic: 'CareNest Health Suite', renewal: 'Lifetime Protected' },
                      ].map((vac, i) => (
                        <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-[#17324D]">{vac.name}</span>
                            <div className="text-[11px] text-slate-400">Administered: {vac.date} · {vac.clinic}</div>
                          </div>
                          <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full self-start sm:self-center">
                            Next due: {vac.renewal}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-View 4: Vitals Log */}
                {recordsTab === 'vitals_history' && (
                  <div className="bg-white rounded-2xl border border-[#E7EEF4] p-6 shadow-xs space-y-4">
                    <h3 className="text-base font-bold text-[#17324D]">Recorded Vitals History</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                            <th className="pb-3">Date &amp; Time</th>
                            <th className="pb-3">Blood Pressure</th>
                            <th className="pb-3">Heart Rate</th>
                            <th className="pb-3">Oxygen (SpO2)</th>
                            <th className="pb-3">BMI</th>
                            <th className="pb-3">Recorded By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr className="hover:bg-slate-50/70">
                            <td className="py-3 font-bold text-[#17324D]">Today, 08:30 AM</td>
                            <td className="py-3 text-blue-600 font-bold">128/82 mmHg</td>
                            <td className="py-3 text-red-600 font-bold">74 bpm</td>
                            <td className="py-3 text-teal-600 font-bold">98 %</td>
                            <td className="py-3 text-emerald-600 font-bold">25.4</td>
                            <td className="py-3 text-slate-500">Dr. Taylor (In-Clinic)</td>
                          </tr>
                          <tr className="hover:bg-slate-50/70">
                            <td className="py-3 font-bold text-[#17324D]">Sept 12, 2026</td>
                            <td className="py-3 text-blue-600 font-bold">124/80 mmHg</td>
                            <td className="py-3 text-red-600 font-bold">72 bpm</td>
                            <td className="py-3 text-teal-600 font-bold">98 %</td>
                            <td className="py-3 text-emerald-600 font-bold">25.3</td>
                            <td className="py-3 text-slate-500">CareNest Nurse Triage</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==============================================================
                TAB 4: MEDICATIONS (Patient Friendly)
               ============================================================== */}
            {activeTab === 'medications' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#17324D]">My Active Medications</h2>
                    <p className="text-sm text-slate-500">Prescription instructions, daily intake guidance, and one-click pharmacy refills.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNotification('Refill request sent to CareNest Pharmacy for all active medications!');
                      setTimeout(() => setNotification(null), 4000);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Request All Refills</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {medications.map((med) => (
                    <div key={med.id} className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="p-2 rounded-xl bg-teal-50 text-[#0F9D9A]">
                            <Pill className="w-5 h-5" />
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[11px] font-bold">
                            {med.tag}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-[#17324D] mt-3">{med.name}</h3>
                        <p className="text-xs font-semibold text-teal-600">{med.dosage}</p>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed bg-[#F8FAFD] p-2.5 rounded-xl border border-slate-100">
                          {med.instructions}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2] text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Prescribed by:</span>
                          <span className="font-bold text-[#17324D]">{med.prescribedBy}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Refills remaining:</span>
                          <span className="font-bold text-[#0F9D9A]">{med.refillsLeft} refills</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setNotification(`Refill ordered for ${med.name}. Estimated ready in 2 hours at CareNest Pharmacy.`);
                          setTimeout(() => setNotification(null), 4000);
                        }}
                        className="w-full py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#D5E2EC] text-xs font-semibold text-[#17324D] transition-colors cursor-pointer"
                      >
                        Refill This Medication
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 5: TEST RESULTS (Explained for Patients)
               ============================================================== */}
            {activeTab === 'results' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#17324D]">My Test Results</h2>
                  <p className="text-sm text-slate-500">Lab panels and diagnostic radiology explained in clear, patient-friendly language.</p>
                </div>

                <div className="space-y-4">
                  {testResults.map((res) => (
                    <div key={res.id} className="p-6 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-teal-50 text-[#0F9D9A]">
                            <FlaskConical className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{res.category} · {res.date}</span>
                            <h3 className="text-base font-bold text-[#17324D]">{res.title}</h3>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold self-start sm:self-center">
                          {res.status}
                        </span>
                      </div>

                      {/* Doctor's Plain English Takeaway */}
                      <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                        <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>What this means for you:</span>
                        </span>
                        <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                          {res.patientExplanation}
                        </p>
                      </div>

                      {/* Result metrics table */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {res.details.map((d, i) => (
                          <div key={i} className="p-3 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2]">
                            <span className="text-slate-400 text-[11px] block">{d.test}</span>
                            <span className="text-sm font-bold text-[#17324D] block mt-0.5">{d.value}</span>
                            <span className="text-[10px] text-teal-700 font-semibold">{d.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 6: MESSAGES (Secure Care Team Messaging)
               ============================================================== */}
            {activeTab === 'messages' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#17324D]">Message My Care Team</h2>
                  <p className="text-sm text-slate-500">Ask questions directly to Dr. Taylor and your clinic nurses.</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E7EEF4] shadow-xs overflow-hidden flex flex-col h-[520px]">
                  {/* Messages Feed */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-4">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-4 rounded-2xl max-w-xl space-y-1.5 ${
                          m.isMe
                            ? 'ml-auto bg-teal-50 border border-teal-200/80 text-teal-950'
                            : 'mr-auto bg-[#F8FAFD] border border-[#E2EBF2] text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#17324D]">{m.sender}</span>
                          <span className="text-[11px] text-slate-400">{m.time}</span>
                        </div>
                        <p className="text-xs sm:text-sm leading-relaxed">
                          {m.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Send Message Form */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-white flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Type your message to Dr. Taylor..."
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[#F7FAFD] border border-[#E2EBF2] text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0F9D9A]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 7: SETTINGS (Patient Account, Insurance & Notifications)
               ============================================================== */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#17324D]">Account &amp; Privacy Settings</h2>
                  <p className="text-sm text-slate-500">Manage your contact information, insurance card, and notification reminders.</p>
                </div>

                {/* Patient Information Summary */}
                <div className="p-6 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-base font-bold text-[#17324D]">My Personal Details</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setNotification('Profile details are verified with CareNest Health.');
                        setTimeout(() => setNotification(null), 3000);
                      }}
                      className="text-xs font-bold text-[#0F9D9A] hover:text-[#0D8B88] cursor-pointer"
                    >
                      Request Update
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2]">
                      <span className="text-slate-400 block mb-1">Full Legal Name</span>
                      <span className="font-bold text-[#17324D] text-sm">{patient.name}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2]">
                      <span className="text-slate-400 block mb-1">Date of Birth &amp; Age</span>
                      <span className="font-bold text-[#17324D] text-sm">{patient.dob} ({patient.age} yrs)</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2]">
                      <span className="text-slate-400 block mb-1">Medical Record Number (MRN)</span>
                      <span className="font-mono font-bold text-[#0F9D9A] text-sm">{patient.mrn}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2]">
                      <span className="text-slate-400 block mb-1">Phone Number</span>
                      <span className="font-medium text-slate-700">{patient.phone}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2]">
                      <span className="text-slate-400 block mb-1">Home Address</span>
                      <span className="font-medium text-slate-700">{patient.address}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2]">
                      <span className="text-slate-400 block mb-1">Emergency Contact</span>
                      <span className="font-medium text-slate-700">{patient.emergencyContact.name} ({patient.emergencyContact.relation}) · {patient.emergencyContact.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Digital Health Insurance Card */}
                <div className="p-6 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#17324D]">Digital Health Insurance Card</h3>
                      <p className="text-xs text-slate-400">Accepted at all CareNest clinics, affiliated hospitals, and network pharmacies.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInsuranceModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      View Digital Card
                    </button>
                  </div>
                </div>

                {/* Notification Reminders */}
                <div className="p-6 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-4">
                  <h3 className="text-base font-bold text-[#17324D]">Notification &amp; Reminder Preferences</h3>
                  <div className="space-y-3">
                    {[
                      {
                        key: 'smsReminders',
                        label: 'SMS Appointment Reminders',
                        desc: 'Receive text message reminders 24 hours and 2 hours before your scheduled visit.',
                      },
                      {
                        key: 'emailLabResults',
                        label: 'Email Notifications for New Test Results',
                        desc: 'Receive an email as soon as Dr. Taylor reviews and releases your lab results.',
                      },
                      {
                        key: 'doctorMessageAlerts',
                        label: 'Care Team Message Alerts',
                        desc: 'Get notified immediately when your physician or clinic nurse replies to you.',
                      },
                      {
                        key: 'medicationRefillPushes',
                        label: 'Medication Refill Reminders',
                        desc: 'Get helpful reminders 5 days before your prescriptions need refilling.',
                      },
                    ].map((pref) => {
                      const isEnabled = notificationSettings[pref.key as keyof typeof notificationSettings];
                      return (
                        <div key={pref.key} className="flex items-center justify-between p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2]">
                          <div>
                            <div className="text-xs sm:text-sm font-bold text-[#17324D]">{pref.label}</div>
                            <div className="text-xs text-slate-400">{pref.desc}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setNotificationSettings((prev) => ({
                                ...prev,
                                [pref.key]: !prev[pref.key as keyof typeof prev],
                              }))
                            }
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                              isEnabled ? 'bg-[#0F9D9A]' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                                isEnabled ? 'left-5' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ==============================================================
          MODAL: BOOK APPOINTMENT
         ============================================================== */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7EEF4] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-50 text-[#0F9D9A]">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#17324D]">Book New Appointment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAppointmentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookAppointmentSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Choose Doctor</label>
                <select
                  value={newAppointmentForm.doctor}
                  onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, doctor: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                >
                  <option value="Dr. Taylor">Dr. Taylor (Pulmonology &amp; Preventive Care)</option>
                  <option value="Dr. Elena Vance, MD">Dr. Elena Vance, MD (Radiology)</option>
                  <option value="Dr. Marcus Chen, MD">Dr. Marcus Chen, MD (Cardiology)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date</label>
                  <input
                    type="date"
                    value={newAppointmentForm.date}
                    onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Time</label>
                  <input
                    type="text"
                    value={newAppointmentForm.time}
                    onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, time: e.target.value })}
                    placeholder="e.g. 10:30 AM"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Visit Type</label>
                <select
                  value={newAppointmentForm.type}
                  onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                >
                  <option value="In-Clinic Consultation">In-Clinic Consultation</option>
                  <option value="Teleconsult Video Visit">Teleconsult Video Visit</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason for Visit</label>
                <input
                  type="text"
                  value={newAppointmentForm.reason}
                  onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, reason: e.target.value })}
                  placeholder="e.g. Annual health checkup or breathing check"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAppointmentModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold shadow-xs cursor-pointer"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: DIGITAL INSURANCE CARD
         ============================================================== */}
      {showInsuranceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7EEF4] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#17324D]">Digital Insurance Card</h3>
              <button
                type="button"
                onClick={() => setShowInsuranceModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Insurance Card Graphic */}
            <div className="rounded-2xl p-5 bg-gradient-to-tr from-[#17324D] to-[#0F9D9A] text-white shadow-lg space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs uppercase tracking-widest text-teal-200 font-bold">CareNest Health Plan</div>
                  <div className="text-lg font-extrabold">{patient.insurance.plan}</div>
                </div>
                <Heart className="w-6 h-6 text-teal-300" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                <div>
                  <span className="text-teal-200 text-[10px] uppercase block">Member Name</span>
                  <span className="font-bold">{patient.name}</span>
                </div>
                <div>
                  <span className="text-teal-200 text-[10px] uppercase block">Member ID</span>
                  <span className="font-mono font-bold">{patient.insurance.memberId}</span>
                </div>
                <div>
                  <span className="text-teal-200 text-[10px] uppercase block">Group Number</span>
                  <span className="font-mono">{patient.insurance.groupNumber}</span>
                </div>
                <div>
                  <span className="text-teal-200 text-[10px] uppercase block">Valid Thru</span>
                  <span>{patient.insurance.validThru}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setNotification('Insurance card saved to your phone.');
                  setShowInsuranceModal(false);
                  setTimeout(() => setNotification(null), 3000);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white text-xs font-semibold text-center cursor-pointer"
              >
                Save to Phone
              </button>
              <button
                type="button"
                onClick={() => setShowInsuranceModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: SHARE HEALTH RECORDS
         ============================================================== */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7EEF4] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#0F9D9A]" />
                <h3 className="text-base font-bold text-[#17324D]">Share Health Records</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Generate a secure, encrypted link for another clinic, hospital, or specialist. The recipient will be able to review your visit summaries and recent test results for 48 hours.
            </p>

            <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2EBF2] space-y-2 text-xs">
              <span className="font-semibold text-slate-700 block">Secure Share Link</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`https://carenest.health/share/rec-${patient.id}-exp48h`}
                  className="flex-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0F9D9A] text-white font-semibold text-xs cursor-pointer"
                >
                  {copiedLink ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-teal-600" />
                <span>Protected by HIPAA end-to-end patient encryption</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
