'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRBAC } from '@/context/RBACContext';
import { useIndicLanguage } from '@/context/IndicLanguageContext';
import IndicLanguageSelector from '@/components/common/IndicLanguageSelector';
import { clinicalApiService, Patient as ApiPatient } from '@/services/clinicalApiService';
import {
  Users,
  Calendar,
  FileText,
  Pill,
  FlaskConical,
  Layers,
  CreditCard,
  MessageSquare,
  CheckSquare,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Plus,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  MoreVertical,
  X,
  Lock,
  Heart,
  Stethoscope,
  Check,
  Send,
  Download,
  Phone,
  CalendarDays,
  ShieldCheck,
  RefreshCw,
  LogOut,
  ExternalLink,
  Activity,
} from 'lucide-react';

/* ── Interfaces ── */
export interface Patient {
  id: string;
  name: string;
  avatarBg: string;
  initials: string;
  mrn: string;
  age: number;
  gender: 'M' | 'F';
  type: string;
  primaryDiagnosis: string;
  lastVisit: string;
  nextAppointment: string;
  nextAppointmentTime: string;
  status: 'Active' | 'Pending' | 'Discharged';
  phone: string;
  bloodPressure: string;
  allergies: string[];
}

export interface Prescription {
  id: string;
  patientName: string;
  patientMrn: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  datePrescribed: string;
  status: 'Active' | 'Refill Requested' | 'Discontinued';
}

export interface LabResult {
  id: string;
  patientName: string;
  patientMrn: string;
  testName: string;
  orderedDate: string;
  status: 'Pending Review' | 'Reviewed & Approved' | 'Critical Review';
  value: string;
  refRange: string;
  isAbnormal?: boolean;
}

export interface ClinicalTask {
  id: string;
  title: string;
  patientName?: string;
  priority: 'High' | 'Medium' | 'Low';
  dueTime: string;
  completed: boolean;
}

export interface ClinicalMessage {
  id: string;
  sender: string;
  senderRole: string;
  avatarBg: string;
  text: string;
  time: string;
  unread?: boolean;
}

/* ── Clinical Initial State (Empty: Connected dynamically to /api/clinical) ── */
const INITIAL_PATIENTS: Patient[] = [];
const INITIAL_PRESCRIPTIONS: Prescription[] = [];
const INITIAL_LABS: LabResult[] = [];
const INITIAL_TASKS: ClinicalTask[] = [];
const INITIAL_MESSAGES: ClinicalMessage[] = [];

function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getScheduleDates(): string[] {
  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return formatScheduleDate(date);
  });
}

export default function DoctorPortal() {
  const { currentUser, isAuthenticated, isSessionReady, iamUser, switchPersona, logout, logoutIAM } = useRBAC();
  const { t } = useIndicLanguage();
  const isDoctor = isAuthenticated && Boolean(currentUser?.id) && (currentUser?.role === 'doctor' || currentUser?.role === 'radiologist' || currentUser?.role === 'admin');
  const attendingDoctorName = currentUser?.name
    ? (currentUser.name.toLowerCase().startsWith('dr') ? currentUser.name : `Dr. ${currentUser.name}`)
    : (iamUser?.username || 'Attending Physician');

  const [activeNav, setActiveNav] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => formatScheduleDate(new Date()));
  const [scheduleDates] = useState(getScheduleDates);
  const [showDatePickerMenu, setShowDatePickerMenu] = useState(false);
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Core Data States (Live Backend Connected)
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(INITIAL_PRESCRIPTIONS);
  const [labResults, setLabResults] = useState<LabResult[]>(INITIAL_LABS);
  const [tasks, setTasks] = useState<ClinicalTask[]>(INITIAL_TASKS);
  const [messages, setMessages] = useState<ClinicalMessage[]>(INITIAL_MESSAGES);
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [diagnosticReports, setDiagnosticReports] = useState<any[]>([]);
  const [isLoadingClinicalData, setIsLoadingClinicalData] = useState(true);
  const [clinicalLoadError, setClinicalLoadError] = useState<string | null>(null);

  // Filters & Notifications
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [notification, setNotification] = useState<string | null>(null);
  const [showNotificationPopover, setShowNotificationPopover] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Modals
  const [selectedPatientForView, setSelectedPatientForView] = useState<Patient | null>(null);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showBookAppointmentModal, setShowBookAppointmentModal] = useState(false);
  const [showOrderLabModal, setShowOrderLabModal] = useState(false);
  const [targetPatientForRx, setTargetPatientForRx] = useState<Patient | null>(null);
  const [activeActionMenuPatientId, setActiveActionMenuPatientId] = useState<string | null>(null);

  // Analytics Settings
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'6m' | '12m'>('6m');
  const [showAnalyticsSection, setShowAnalyticsSection] = useState(true);

  // Chat message composer
  const [newMessageText, setNewMessageText] = useState('');

  // Settings toggles
  const [settingsUrgentPaging, setSettingsUrgentPaging] = useState(true);
  const [settingsAutoSignLabs, setSettingsAutoSignLabs] = useState(false);
  const [settingsSmsAlerts, setSettingsSmsAlerts] = useState(true);

  // Form states
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    gender: 'M' as 'M' | 'F',
    diagnosis: '',
    phone: '',
    nextTime: '11:30 AM',
  });

  const [newRx, setNewRx] = useState({
    medication: '',
    dosage: '',
    frequency: 'Once daily with meals',
    duration: '30 days',
  });

  const [newApptForm, setNewApptForm] = useState({
    patientId: '',
    date: '2026-10-22',
    time: '11:00 AM',
    type: 'In-Clinic Consultation',
    instructions: 'Routine clinical consultation and vitals review.',
  });

  const [newLabForm, setNewLabForm] = useState({
    patientId: '',
    testName: 'Hemoglobin A1c (HbA1c)',
    value: '5.8 %',
    refRange: '< 5.7 %',
    isAbnormal: false,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  /* ── Live Data Loader ── */
  const loadClinicalData = useCallback(async () => {
    try {
      setIsLoadingClinicalData(true);
      setClinicalLoadError(null);
      const [pts, rxs, labs, apts, reports, msgs] = await Promise.all([
        clinicalApiService.getPatients(),
        clinicalApiService.getPrescriptions(),
        clinicalApiService.getLabResults(),
        clinicalApiService.getAppointments(),
        clinicalApiService.getDiagnosticReports(),
        clinicalApiService.getMessages(),
      ]);

      if (pts) {
        setPatients(
          pts.map((p) => ({
            id: p.id,
            name: p.name,
            avatarBg: p.avatarBg || (p.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700'),
            initials: p.initials || p.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2),
            mrn: p.mrn,
            age: p.age,
            gender: p.gender as 'M' | 'F',
            type: p.type || 'General Care',
            primaryDiagnosis: p.primaryDiagnosis || 'Clinical Assessment',
            lastVisit: p.lastVisit || 'Not recorded',
            nextAppointment: p.nextAppointment || 'Not scheduled',
            nextAppointmentTime: p.nextAppointmentTime || '',
            status: (p.status as 'Active' | 'Pending') || 'Active',
            phone: p.phone,
            bloodPressure: p.bloodPressure || 'Not recorded',
            allergies: p.allergies || [],
          }))
        );
      }
      if (rxs) setPrescriptions(rxs as Prescription[]);
      if (labs) setLabResults(labs as LabResult[]);
      if (apts) setAppointmentsList(apts);
      if (reports) setDiagnosticReports(reports);
      if (msgs) setMessages(msgs as ClinicalMessage[]);
    } catch (err) {
      console.error('Failed to load clinical records from backend:', err);
      setClinicalLoadError('Clinical records could not be loaded. Do not rely on the current counts until a retry succeeds.');
    } finally {
      setIsLoadingClinicalData(false);
    }
  }, []);

  useEffect(() => {
    loadClinicalData();
  }, [loadClinicalData]);

  // Filtered patients for table
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mrn.includes(searchQuery) ||
        p.primaryDiagnosis.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = selectedTypeFilter === 'All' || p.type.toLowerCase().includes(selectedTypeFilter.toLowerCase());
      const matchStatus = selectedStatusFilter === 'All' || p.status === selectedStatusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [patients, searchQuery, selectedTypeFilter, selectedStatusFilter]);

  /* ── Register Patient Handler (Saves to Backend) ── */
  const handleAddPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name.trim()) return;

    const patientPayload = {
      name: newPatient.name.trim(),
      avatarBg: newPatient.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700',
      initials: newPatient.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
      mrn: `100${Math.floor(100 + Math.random() * 900)}`,
      age: Number(newPatient.age) || 40,
      gender: newPatient.gender,
      type: 'General Outpatient',
      primaryDiagnosis: newPatient.diagnosis || 'Clinical Assessment Pending',
      lastVisit: 'Not recorded',
      nextAppointment: 'Not scheduled',
      nextAppointmentTime: newPatient.nextTime || '',
      status: 'Active' as const,
      phone: newPatient.phone || 'Not provided',
      bloodPressure: 'Not recorded',
      allergies: [],
    };

    const saved = await clinicalApiService.createPatient(patientPayload);
    const created: Patient = (saved as Patient) || { ...patientPayload, id: `p-${Date.now()}` };

    setPatients([created, ...patients]);
    setShowNewPatientModal(false);
    setNewPatient({ name: '', age: '', gender: 'M', diagnosis: '', phone: '', nextTime: '11:30 AM' });
    showToast(`Patient ${created.name} (MRN: ${created.mrn}) registered and synced to backend!`);
  };

  /* ── Quick Demo Patient (1-Click for Testing) ── */
  const handleCreateDemoPatient = async () => {
    const demoPayload = {
      name: 'Alex Taylor',
      age: 38,
      gender: 'F' as const,
      phone: '(555) 014-2901',
      primaryDiagnosis: 'Hypertension & Pulmonary Follow-up',
      type: 'Routine Follow-up',
      bloodPressure: '122/80 mmHg',
      allergies: ['Penicillin (Mild)'],
      nextAppointment: '22 Oct 2026',
      nextAppointmentTime: '10:30 AM',
      status: 'Active' as const,
    };
    const saved = await clinicalApiService.createPatient(demoPayload);
    if (saved) {
      await clinicalApiService.createPrescription({
        patientId: saved.id,
        patientName: saved.name,
        patientMrn: saved.mrn,
        medication: 'Lisinopril',
        dosage: '10 mg Oral Tablet',
        frequency: 'Once daily with meals',
        duration: '30 days',
        datePrescribed: 'Today',
        prescribedBy: attendingDoctorName,
        status: 'Active',
      });
      await clinicalApiService.createAppointment({
        patientId: saved.id,
        patientName: saved.name,
        patientMrn: saved.mrn,
        doctorName: attendingDoctorName,
        specialty: 'Internal Medicine',
        date: '2026-10-22',
        time: '10:30 AM',
        type: 'In-Clinic Consultation',
        location: 'Suite 402 · CareNest Medical Center',
        status: 'Confirmed',
      });
      await loadClinicalData();
      showToast(`Quick patient ${saved.name} (MRN: ${saved.mrn}) created with Rx & appointment!`);
    }
  };

  /* ── Clear All Records from Backend ── */
  const handleClearAllRecords = async () => {
    if (window.confirm('Clear all clinical records from backend? All patients, prescriptions, labs, and reports will be wiped.')) {
      await clinicalApiService.clearAllRecords();
      setPatients([]);
      setPrescriptions([]);
      setLabResults([]);
      setAppointmentsList([]);
      setDiagnosticReports([]);
      setMessages([]);
      setTasks([]);
      showToast('All clinical records permanently cleared from backend database.');
    }
  };

  /* ── Write Prescription Handler (Saves to Backend) ── */
  const handleAddPrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRx.medication.trim()) return;

    const selectedPatient = targetPatientForRx || patients[0];
    const patientName = selectedPatient ? selectedPatient.name : 'Outpatient Patient';
    const patientMrn = selectedPatient ? selectedPatient.mrn : '100001';
    const patientId = selectedPatient ? selectedPatient.id : undefined;

    const rxPayload = {
      patientId,
      patientName,
      patientMrn,
      medication: newRx.medication.trim(),
      dosage: newRx.dosage.trim() || '10 mg Oral Tablet',
      frequency: newRx.frequency,
      duration: newRx.duration,
      datePrescribed: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
      prescribedBy: attendingDoctorName,
      status: 'Active' as const,
      instructions: `Take ${newRx.dosage || '10mg'} - ${newRx.frequency}`,
      refillsLeft: 3,
      tag: 'Prescription Order',
    };

    const savedRx = await clinicalApiService.createPrescription(rxPayload);
    const createdRx: Prescription = (savedRx as Prescription) || { ...rxPayload, id: `rx-${Date.now()}` };

    setPrescriptions([createdRx, ...prescriptions]);
    setShowPrescriptionModal(false);
    setNewRx({ medication: '', dosage: '', frequency: 'Once daily with meals', duration: '30 days' });
    showToast(`Prescription for ${createdRx.medication} saved to patient chart & pharmacy!`);
  };

  /* ── Book Appointment Handler (Saves to Backend) ── */
  const handleBookAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selPatient = patients.find((p) => p.id === newApptForm.patientId) || patients[0];
    const pName = selPatient ? selPatient.name : 'Walk-in Patient';
    const pMrn = selPatient ? selPatient.mrn : '100001';

    const aptPayload = {
      patientId: selPatient?.id,
      patientName: pName,
      patientMrn: pMrn,
      doctorName: attendingDoctorName,
      specialty: 'Internal Medicine & Outpatient Suite',
      date: newApptForm.date,
      time: newApptForm.time,
      type: newApptForm.type,
      location: 'Outpatient Examination Suite · Room 2',
      status: 'Confirmed' as const,
      instructions: newApptForm.instructions || 'Routine clinical visit.',
    };

    const savedApt = await clinicalApiService.createAppointment(aptPayload);
    if (savedApt) {
      setAppointmentsList([savedApt, ...appointmentsList]);
    }
    setShowBookAppointmentModal(false);
    showToast(`Appointment confirmed for ${pName} on ${newApptForm.date} at ${newApptForm.time}!`);
  };

  /* ── Order Lab Result Handler (Saves to Backend) ── */
  const handleOrderLabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selPatient = patients.find((p) => p.id === newLabForm.patientId) || patients[0];
    const pName = selPatient ? selPatient.name : 'Outpatient Patient';
    const pMrn = selPatient ? selPatient.mrn : '100001';

    const labPayload = {
      patientId: selPatient?.id,
      patientName: pName,
      patientMrn: pMrn,
      testName: newLabForm.testName,
      orderedDate: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Pending Review' as const,
      value: newLabForm.value,
      refRange: newLabForm.refRange,
      isAbnormal: newLabForm.isAbnormal,
      doctorOrLab: `${attendingDoctorName} / CareNest Diagnostic Lab`,
    };

    const savedLab = await clinicalApiService.createLabResult(labPayload);
    if (savedLab) {
      setLabResults([savedLab as any, ...labResults]);
    }
    setShowOrderLabModal(false);
    showToast(`Laboratory panel ordered for ${pName}!`);
  };

  /* ── Toggle Task Completed ── */
  const handleToggleTask = (taskId: string) => {
    setTasks(
      tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  /* ── Send Message (Saves to Backend) ── */
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    const msgPayload = {
      sender: attendingDoctorName,
      senderRole: 'Internal Medicine Lead',
      avatarBg: 'bg-[#0F9D9A] text-white',
      text: newMessageText.trim(),
      time: 'Just now',
      unread: false,
    };

    const savedMsg = await clinicalApiService.sendMessage(msgPayload);
    const msg: ClinicalMessage = (savedMsg as ClinicalMessage) || { ...msgPayload, id: `m-${Date.now()}` };

    setMessages([...messages, msg]);
    setNewMessageText('');
    showToast('Clinical communication sent to patient & care team.');
  };

  /* ── Authorization Gate ── */
  if (!isSessionReady) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="w-4 h-4 rounded-full border-2 border-[#0F9D9A] border-t-transparent animate-spin" />
          <span>Verifying clinician session...</span>
        </div>
      </div>
    );
  }

  if (!isDoctor) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] font-sans flex items-center justify-center p-4 antialiased">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-[#E7EEF4] text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-[#0F9D9A] mx-auto flex items-center justify-center shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-teal-50 text-[#0F9D9A] text-xs font-bold uppercase tracking-wider">
              Clinical Access Only
            </span>
            <h2 className="text-2xl font-extrabold text-[#17324D] mt-2">
              Physician Authentication Required
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {currentUser?.name
                ? `You are signed in as ${currentUser.name} (${currentUser.role}). This workstation is strictly restricted to verified clinicians.`
                : 'This clinical diagnostic workstation requires verified physician credentials. Please sign in to proceed.'}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/login?redirect=/doctor"
              className="w-full py-3 px-4 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Stethoscope className="w-4 h-4" />
              <span>Sign In as Physician</span>
            </Link>

            {isAuthenticated && currentUser?.role === 'patient' && (
              <Link
                href="/emr"
                className="w-full py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-[#17324D] border border-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4 text-[#0F9D9A]" />
                <span>Go to Your Patient Health Portal</span>
              </Link>
            )}

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
            LEFT SIDEBAR NAVIGATION
           ============================================================== */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#E7EEF4] flex flex-col justify-between transition-transform duration-300 lg:static lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col">
            {/* Brand Logo */}
            <div className="h-20 px-6 flex items-center justify-between border-b border-[#F0F4F8]">
              <Link href="/doctor" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0F9D9A] to-[#2DD4BF] flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                  <Heart className="w-5 h-5 fill-white/20" />
                </div>
                <div className="flex flex-col">
                  <div className="text-lg font-extrabold text-[#17324D] tracking-tight flex items-center">
                    Care<span className="text-[#0F9D9A]">Nest</span>
                  </div>
                  <span className="text-[9.5px] uppercase font-bold tracking-wider text-slate-400 -mt-1">
                    Doctor Clinical Workstation
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Navigation Items */}
            <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
              {[
                { id: 'doctor_nav_dashboard', fallback: 'Dashboard', navKey: 'dashboard', icon: Activity, dot: false },
                { id: 'doctor_nav_patients', fallback: 'Patients', navKey: 'patients', icon: Users, dot: false },
                { id: 'doctor_nav_appointments', fallback: 'Appointments', navKey: 'appointments', icon: Calendar, dot: false },
                { id: 'doctor_nav_records', fallback: 'Medical Records', navKey: 'records', icon: FileText, dot: false },
                { id: 'doctor_nav_prescriptions', fallback: 'Prescriptions', navKey: 'prescriptions', icon: Pill, dot: false },
                { id: 'doctor_nav_lab', fallback: 'Lab Results', navKey: 'lab', icon: FlaskConical, dot: false },
                { id: 'doctor_nav_imaging', fallback: 'Imaging & Reports', navKey: 'imaging', icon: Layers, dot: false },
                { id: 'doctor_nav_billing', fallback: 'Billing & Insurance', navKey: 'billing', icon: CreditCard, dot: false },
                { id: 'doctor_nav_messages', fallback: 'Messages', navKey: 'messages', icon: MessageSquare, dot: true },
                { id: 'doctor_nav_tasks', fallback: 'Tasks', navKey: 'tasks', icon: CheckSquare, dot: false },
                { id: 'doctor_nav_analytics', fallback: 'Analytics', navKey: 'analytics', icon: BarChart3, dot: false },
                { id: 'doctor_nav_settings', fallback: 'Settings', navKey: 'settings', icon: Settings, dot: false },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.navKey;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.navKey);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#E6F7F7] text-[#0F9D9A] font-bold shadow-xs'
                        : 'text-slate-600 hover:bg-[#F5F9FC] hover:text-[#17324D]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#0F9D9A]' : 'text-slate-400'}`} />
                      <span>{t(item.id, item.fallback)}</span>
                    </div>
                    {item.dot && (
                      <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Card */}
          <div className="p-3.5 m-3.5 rounded-2xl bg-gradient-to-br from-[#E6F7F7] to-[#F0FDF4] border border-teal-100 shadow-xs">
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-teal-600 shadow-xs shrink-0">
                <Stethoscope className="w-4 h-4 text-[#0F9D9A]" />
              </div>
              <h4 className="text-xs font-bold text-[#17324D]">{attendingDoctorName}</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              {currentUser?.roleTitle || 'Lead Physician · CareNest Health'}
            </p>
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
            MAIN CONTENT AREA
           ============================================================== */}
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
          {/* Top Header */}
          <header className="sticky top-0 z-20 h-20 bg-white/90 backdrop-blur-md border-b border-[#E7EEF4] px-4 sm:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 cursor-pointer"
                aria-label="Open menu"
              >
                <Users className="w-5 h-5" />
              </button>

              {/* Patient Search Input with Ctrl+K shortcut */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search patients, charts, conditions or MRN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-16 py-2.5 rounded-xl bg-[#F7FAFD] border border-[#E2EBF2] text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0F9D9A] focus:ring-2 focus:ring-[#0F9D9A]/15 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-400 bg-slate-200/60 border border-slate-300 pointer-events-none">
                  Ctrl K
                </span>
              </div>
            </div>

            {/* Header Right: Language Selector, Notification Bell & Doctor Profile */}
            <div className="flex items-center gap-3 sm:gap-4 relative">
              {/* Language Selector */}
              <IndicLanguageSelector />

              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotificationPopover(!showNotificationPopover)}
                  className="relative p-2.5 rounded-xl bg-[#F7FAFD] border border-[#E2EBF2] text-slate-600 hover:text-[#0F9D9A] transition-colors cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                      {unreadNotifications}
                    </span>
                  )}
                </button>

                {/* Notifications Popover Dropdown */}
                {showNotificationPopover && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-[#E7EEF4] shadow-2xl p-3 z-30 animate-in fade-in duration-150 text-xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <span className="font-bold text-[#17324D]">Clinical Alerts &amp; Notices</span>
                      <button
                        type="button"
                        onClick={() => {
                          setUnreadNotifications(0);
                          showToast('All notifications marked as read.');
                        }}
                        className="text-[11px] text-[#0F9D9A] hover:underline font-semibold cursor-pointer"
                      >
                        Mark all read
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 rounded-xl bg-red-50/80 border border-red-200/60 text-slate-700">
                        <div className="flex items-center gap-1.5 font-bold text-red-700 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          <span>Critical Allergy Flag: Penicillin</span>
                        </div>
                        <p className="text-[10.5px] text-slate-600 mt-1">
                          Severe Anaphylaxis risk for John Smith (MRN: 100245).
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-slate-700">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[11px]">
                          <Activity className="w-3.5 h-3.5 text-amber-600" />
                          <span>High Blood Pressure: 160/98 mmHg</span>
                        </div>
                        <p className="text-[10.5px] text-slate-600 mt-1">
                          Patient Rahul Mehta requires immediate medication titration.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/60 text-slate-700">
                        <div className="flex items-center gap-1.5 font-bold text-blue-700 text-[11px]">
                          <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
                          <span>HbA1c Lab Report Pending Sign-off</span>
                        </div>
                        <p className="text-[10.5px] text-slate-600 mt-1">
                          Laboratory specimen for John Smith uploaded from LabQuest.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Doctor Profile Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-[#F7FAFD] hover:bg-[#EEF5FA] border border-[#E2EBF2] transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0F9D9A] to-sky-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {(currentUser?.name || iamUser?.username || 'EV')
                      .split(' ')
                      .filter(Boolean)
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-bold text-[#17324D] leading-tight">
                      {attendingDoctorName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">{currentUser?.roleTitle || 'Internal Medicine Lead'}</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-[#E7EEF4] shadow-2xl p-3 z-30 animate-in fade-in duration-150 text-xs">
                    <div className="flex items-center gap-3 p-2 bg-[#F8FAFD] rounded-xl mb-2">
                      <div className="w-10 h-10 rounded-full bg-[#0F9D9A] text-white flex items-center justify-center font-bold text-sm">
                        {attendingDoctorName
                          .replace(/^Dr\.\s*/i, '')
                          .split(' ')
                          .filter(Boolean)
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase() || 'DR'}
                      </div>
                      <div>
                        <div className="font-bold text-[#17324D]">{attendingDoctorName}</div>
                        <div className="text-slate-400 text-[11px]">{currentUser?.email || 'NPI: 1849201948 · License #MA-8841'}</div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowNewPatientModal(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-[#0F9D9A]" />
                        <span>Register New Patient</span>
                      </button>

                      <Link
                        href="/emr"
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        <Heart className="w-4 h-4 text-[#0F9D9A]" />
                        <span>Open Patient EMR Portal</span>
                      </Link>

                      <Link
                        href="/login"
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        <Lock className="w-4 h-4 text-[#0F9D9A]" />
                        <span>AWS IAM RBAC Sign-in</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleCreateDemoPatient();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-teal-700 hover:bg-teal-50 font-medium cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-[#0F9D9A]" />
                        <span>Load Sample Patient Chart</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleClearAllRecords();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-amber-700 hover:bg-amber-50 font-medium cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4 text-amber-600" />
                        <span>Clear All Clinical Data (Reset)</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await logoutIAM();
                          } catch {
                            // continue cleanup
                          }
                          logout();
                          window.location.href = '/';
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-medium cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Sign Out Doctor Session</span>
                      </button>
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-100">
                      <Link
                        href="/"
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-slate-400 hover:text-slate-600 font-semibold text-[11px]"
                      >
                        Return to MiPAAS Home
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ==============================================================
              DYNAMIC VIEW SWITCHER
             ============================================================== */}
          <main className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
            {clinicalLoadError && (
              <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
                <span>{clinicalLoadError}</span>
                <button
                  type="button"
                  onClick={loadClinicalData}
                  className="self-start sm:self-auto rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700"
                >
                  Retry
                </button>
              </div>
            )}
            {/* Top Bar: Doctor Greeting & Date Selector */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0F9D9A] to-[#2DD4BF] text-white flex items-center justify-center font-bold text-base shadow-sm ring-2 ring-white">
                  {attendingDoctorName
                    .replace(/^Dr\.\s*/i, '')
                    .split(' ')
                    .filter(Boolean)
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'DR'}
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17324D] tracking-tight">
                    {greeting}, {attendingDoctorName}
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    CareNest Clinic workstation:{' '}
                    <strong className="text-[#0F9D9A] font-bold">{appointmentsList.length}</strong>{' '}
                    {appointmentsList.length === 1 ? 'appointment' : 'appointments'} on the live schedule.
                  </p>
                </div>
              </div>

              {/* Action Controls: Date Picker & + New Patient Button */}
              <div className="flex items-center gap-3 relative">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDatePickerMenu(!showDatePickerMenu)}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-[#D5E2EC] text-[#17324D] font-semibold text-xs sm:text-sm shadow-xs cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span>{selectedDate}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {showDatePickerMenu && (
                    <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-xl p-2 z-30 text-xs">
                      <div className="font-bold text-slate-400 text-[10px] uppercase tracking-wider px-2 py-1">
                        Select Clinic Schedule
                      </div>
                      {scheduleDates.map((d, index) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setSelectedDate(d);
                            setShowDatePickerMenu(false);
                            showToast(`Switched schedule to ${d}`);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                            selectedDate === d ? 'bg-[#0F9D9A] text-white' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {d} {index === 0 && '(Today)'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Patient</span>
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                VIEW 1: EXECUTIVE DASHBOARD
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* 4 Summary Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div
                    onClick={() => setActiveNav('patients')}
                    className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs hover:shadow-md transition-all flex items-start justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-500">{t('doctor_stat_active_patients', 'Total Patients')}</div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-[#17324D]">{patients.length}</span>
                        <span className="inline-flex items-center text-xs font-bold text-[#10B981]">
                          Live
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {patients.length > 0 ? 'Synced from clinical records' : 'No patients on file'}
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#EBF3FE] text-[#2563EB] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveNav('appointments')}
                    className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs hover:shadow-md transition-all flex items-start justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-500">{t('doctor_stat_today_appts', "Today's Appointments")}</div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-[#17324D]">{appointmentsList.length}</span>
                        <span className="inline-flex items-center text-xs font-bold text-[#10B981]">
                          {appointmentsList.length > 0 ? 'Live' : 'Scheduled'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {appointmentsList.length > 0
                          ? `${appointmentsList.filter((a: any) => a.status === 'Completed').length} completed, ${appointmentsList.filter((a: any) => a.status !== 'Completed').length} upcoming`
                          : 'No appointments today'}
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#E6F7F7] text-[#0F9D9A] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Calendar className="w-5 h-5" />
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveNav('lab')}
                    className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs hover:shadow-md transition-all flex items-start justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-500">{t('doctor_stat_pending_labs', 'Pending Lab Results')}</div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-[#17324D]">{labResults.filter((l) => l.status !== 'Reviewed & Approved').length}</span>
                        <span className="inline-flex items-center text-xs font-bold text-[#EF4444]">
                          Require Review
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {labResults.length > 0 ? `${labResults.length} total laboratory tests` : 'No pending lab orders'}
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#F3EFFC] text-[#8B5CF6] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FlaskConical className="w-5 h-5" />
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      const el = document.getElementById('critical-alerts-box');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs hover:shadow-md transition-all flex items-start justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-500">{t('doctor_stat_urgent_alerts', 'Urgent Alerts')}</div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-[#EF4444]">
                          {diagnosticReports.filter((r) => r.criticalAlert || r.riskLevel === 'High' || r.riskLevel === 'Critical').length}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {diagnosticReports.filter((r) => r.riskLevel === 'Critical').length} critical,{' '}
                        {diagnosticReports.filter((r) => r.riskLevel === 'High').length} high priority
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* 3 Middle Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Today's Schedule Card */}
                  <div className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#0F9D9A]" />
                        <h3 className="font-bold text-sm text-[#17324D]">Today&apos;s Schedule</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveNav('appointments')}
                        className="text-xs font-semibold text-[#0F9D9A] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>View all</span>
                        <span>→</span>
                      </button>
                    </div>

                    <div className="space-y-3.5 relative">
                      {appointmentsList.length === 0 && patients.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs">
                          <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-600">No appointments scheduled</p>
                          <button
                            type="button"
                            onClick={() => setShowBookAppointmentModal(true)}
                            className="mt-2 text-[#0F9D9A] hover:underline font-semibold cursor-pointer"
                          >
                            + Book First Appointment
                          </button>
                        </div>
                      ) : (
                        (appointmentsList.length > 0
                          ? appointmentsList
                          : patients.slice(0, 5).map((p) => ({
                              time: p.nextAppointmentTime,
                              name: p.name,
                              reason: p.primaryDiagnosis,
                              badge: 'Upcoming',
                              badgeColor: 'bg-[#EBF3FE] text-[#2563EB]',
                            }))
                        ).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-slate-500 w-16">{item.time}</span>
                              <div className="w-2.5 h-2.5 rounded-full bg-[#0F9D9A] ring-4 ring-white shrink-0" />
                              <div>
                                <div className="font-bold text-[#17324D]">{item.name || item.patientName}</div>
                                <div className="text-[11px] text-slate-400">{item.reason || item.type || 'Consultation'}</div>
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                item.badgeColor || 'bg-[#EBF3FE] text-[#2563EB]'
                              }`}
                            >
                              {item.badge || item.status || 'Upcoming'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Recent Patients Card */}
                  <div className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#0F9D9A]" />
                        <h3 className="font-bold text-sm text-[#17324D]">Recent Patients</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveNav('patients')}
                        className="text-xs font-semibold text-[#0F9D9A] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>View all</span>
                        <span>→</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {patients.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs">
                          <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-600">No clinical patients registered</p>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setShowNewPatientModal(true)}
                              className="text-[#0F9D9A] hover:underline font-semibold cursor-pointer"
                            >
                              + Register Patient
                            </button>
                            <span className="text-slate-300">·</span>
                            <button
                              type="button"
                              onClick={handleCreateDemoPatient}
                              className="text-teal-700 hover:underline font-semibold cursor-pointer"
                            >
                              Quick Demo
                            </button>
                          </div>
                        </div>
                      ) : (
                        patients.slice(0, 5).map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs py-1">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full ${p.avatarBg} flex items-center justify-center font-bold text-[11px]`}>
                                {p.initials}
                              </div>
                              <div>
                                <div className="font-bold text-[#17324D]">{p.name}</div>
                                <div className="text-[11px] text-slate-400">MRN: {p.mrn}</div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-slate-600 font-medium">{p.age} y · {p.gender}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[90px]">{p.primaryDiagnosis}</div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedPatientForView(p)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              View
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Critical Alerts Card */}
                  <div id="critical-alerts-box" className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                        <h3 className="font-bold text-sm text-[#17324D]">Critical Alerts</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => showToast('Physician alerts updated from patient vitals.')}
                        className="text-xs font-semibold text-[#0F9D9A] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Refresh</span>
                        <span>→</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {patients.filter((p) => p.allergies && p.allergies.length > 0 && !p.allergies.includes('None reported')).length === 0 &&
                      patients.filter((p) => p.bloodPressure && parseInt(p.bloodPressure) >= 140).length === 0 &&
                      labResults.filter((l) => l.isAbnormal).length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-center text-slate-500">
                          <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-1" />
                          <span className="font-semibold text-slate-700 block">No Critical Alerts</span>
                          <span className="text-[11px] text-slate-400">All patient vitals and lab panels within normal ranges.</span>
                        </div>
                      ) : (
                        <>
                          {patients
                            .filter((p) => p.allergies && p.allergies.length > 0 && !p.allergies.includes('None reported'))
                            .slice(0, 2)
                            .map((p) => (
                              <div key={`al-${p.id}`} className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[#B91C1C] font-bold">
                                    <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
                                    <span>Allergy: {p.allergies[0]}</span>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626]">
                                    Alert
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-tight">
                                  Patient: {p.name} (MRN: {p.mrn}). Exercise caution with contraindicated meds.
                                </p>
                              </div>
                            ))}
                          {patients
                            .filter((p) => p.bloodPressure && parseInt(p.bloodPressure) >= 140)
                            .slice(0, 2)
                            .map((p) => (
                              <div key={`bp-${p.id}`} className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[#B45309] font-bold">
                                    <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
                                    <span>Elevated Blood Pressure: {p.bloodPressure}</span>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEF3C7] text-[#D97706]">
                                    High
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-tight">
                                  Patient {p.name} telemetry requires medication titration.
                                </p>
                              </div>
                            ))}
                          {labResults
                            .filter((l) => l.isAbnormal)
                            .slice(0, 2)
                            .map((l) => (
                              <div key={`lab-${l.id}`} className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[#1D4ED8] font-bold">
                                    <Info className="w-3.5 h-3.5 text-[#3B82F6]" />
                                    <span>Abnormal Lab: {l.testName}</span>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#DBEAFE] text-[#2563EB]">
                                    Review
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-tight">
                                  Patient {l.patientName} (MRN: {l.patientMrn}) value {l.value} outside ref range ({l.refRange}).
                                </p>
                              </div>
                            ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Patient Directory Table */}
                <div id="all-patients-section" className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-[#17324D]">All Patients</h3>
                      <div className="relative min-w-[220px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search patients..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#F7FAFD] border border-[#E2EBF2] text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0F9D9A]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <select
                        value={selectedTypeFilter}
                        onChange={(e) => setSelectedTypeFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 bg-white"
                      >
                        <option value="All">All Types</option>
                        <option value="Routine">Routine</option>
                        <option value="Diabetes">Diabetes</option>
                        <option value="Hypertension">Hypertension</option>
                        <option value="Consultation">Consultation</option>
                      </select>

                      <select
                        value={selectedStatusFilter}
                        onChange={(e) => setSelectedStatusFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 bg-white"
                      >
                        <option value="All">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setShowNewPatientModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Patient</span>
                      </button>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-[#F8FAFD] text-slate-400 font-semibold border-y border-slate-100">
                        <tr>
                          <th className="py-3 px-4">Patient Name</th>
                          <th className="py-3 px-3">MRN</th>
                          <th className="py-3 px-3">Age / Gender</th>
                          <th className="py-3 px-3">Primary Diagnosis</th>
                          <th className="py-3 px-3">Last Visit</th>
                          <th className="py-3 px-3">Next Appointment</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPatients.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400">
                              <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                              <p className="font-semibold text-slate-700 text-sm">No clinical patients found</p>
                              <p className="text-xs text-slate-400 mt-0.5">Register a new patient or load a demo patient to begin</p>
                              <div className="mt-3 flex items-center justify-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setShowNewPatientModal(true)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F9D9A] text-white text-xs font-semibold hover:bg-[#0D8B88] cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Register New Patient</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCreateDemoPatient}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold hover:bg-teal-100 cursor-pointer"
                                >
                                  <span>+ Quick Demo Patient</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredPatients.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full ${p.avatarBg} flex items-center justify-center font-bold text-xs shrink-0`}>
                                    {p.initials}
                                  </div>
                                  <span className="font-bold text-[#17324D]">{p.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-500">{p.mrn}</td>
                              <td className="py-3 px-3">{p.age} y · {p.gender}</td>
                              <td className="py-3 px-3 font-medium text-slate-700">{p.primaryDiagnosis}</td>
                              <td className="py-3 px-3 text-slate-500">{p.lastVisit}</td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-700">{p.nextAppointment}</div>
                                <div className="text-[10px] text-slate-400">{p.nextAppointmentTime}</div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full bg-[#E8F8F5] text-[#10B981] font-bold text-[11px]">
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right relative">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPatientForView(p)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTargetPatientForRx(p);
                                      setShowPrescriptionModal(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold hover:bg-teal-100 transition-colors cursor-pointer"
                                    title="Write Prescription"
                                  >
                                    Rx
                                  </button>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveActionMenuPatientId(activeActionMenuPatientId === p.id ? null : p.id)
                                      }
                                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                                      title="More options"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                    {activeActionMenuPatientId === p.id && (
                                      <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-30 text-xs text-left">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedPatientForView(p);
                                            setActiveActionMenuPatientId(null);
                                          }}
                                          className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                                          <span>Full Clinical Chart</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setTargetPatientForRx(p);
                                            setShowPrescriptionModal(true);
                                            setActiveActionMenuPatientId(null);
                                          }}
                                          className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                                        >
                                          <Pill className="w-3.5 h-3.5 text-teal-600" />
                                          <span>Write Prescription</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            showToast(`Appointment rescheduled for ${p.name}`);
                                            setActiveActionMenuPatientId(null);
                                          }}
                                          className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                                        >
                                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                          <span>Reschedule Visit</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 2: PATIENTS DIRECTORY (Detailed)
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'patients' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Patient Directory &amp; Rosters</h2>
                    <p className="text-xs text-slate-500">Manage patient demographics, clinical status, and medical histories.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCreateDemoPatient}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-semibold text-xs cursor-pointer hover:bg-teal-100"
                    >
                      <span>+ Demo Patient</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewPatientModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Register Patient</span>
                    </button>
                  </div>
                </div>

                {filteredPatients.length === 0 ? (
                  <div className="p-12 rounded-2xl bg-white border border-[#E7EEF4] text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-[#17324D]">No Clinical Patients Found</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      Register your first patient or load a test patient profile to start documenting encounters.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowNewPatientModal(true)}
                        className="px-4 py-2 rounded-xl bg-[#0F9D9A] text-white text-xs font-semibold hover:bg-[#0D8B88] cursor-pointer"
                      >
                        + Register Patient
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateDemoPatient}
                        className="px-4 py-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold hover:bg-teal-100 cursor-pointer"
                      >
                        Quick Demo Patient
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {filteredPatients.map((p) => (
                      <div key={p.id} className="p-4 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full ${p.avatarBg} flex items-center justify-center font-bold text-sm`}>
                              {p.initials}
                            </div>
                            <div>
                              <h4 className="font-bold text-[#17324D] text-sm">{p.name}</h4>
                              <span className="text-[11px] text-slate-400 font-mono">MRN: {p.mrn}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-[#E8F8F5] text-[#10B981] font-bold text-[10px]">
                            {p.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-slate-50">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Condition:</span>
                            <span className="font-semibold text-slate-700">{p.primaryDiagnosis}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Blood Pressure:</span>
                            <span className="font-semibold text-slate-700">{p.bloodPressure}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-slate-400 text-[11px] flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {p.phone}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setTargetPatientForRx(p);
                                setShowPrescriptionModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-teal-200 text-teal-700 text-xs font-semibold hover:bg-teal-50 cursor-pointer"
                            >
                              Rx
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetPatientForRx(p);
                                setShowOrderLabModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-50 cursor-pointer"
                            >
                              Lab
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 3: CLINICAL APPOINTMENTS SCHEDULE
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'appointments' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Clinical Appointments Schedule</h2>
                    <p className="text-xs text-slate-500">{selectedDate} · {attendingDoctorName} Outpatient Suite</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBookAppointmentModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Book Appointment</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {appointmentsList.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white border border-[#E7EEF4] text-center text-slate-400">
                      <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700 text-sm">No scheduled patient appointments</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Appointments booked from the patient portal or physician workstation will display here.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowBookAppointmentModal(true)}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Book Appointment</span>
                      </button>
                    </div>
                  ) : (
                    appointmentsList.map((appt, i) => (
                      <div
                        key={appt.id || i}
                        className="p-4 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                            <Clock className="w-5 h-5 text-[#0F9D9A]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#17324D] text-sm">{appt.patientName || appt.name}</span>
                              <span className="text-[11px] text-slate-400 font-mono">MRN: {appt.patientMrn || appt.mrn}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {appt.location || 'Suite 402'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{appt.specialty || appt.type || 'Clinical Consultation'}</p>
                            <span className="text-[11px] text-slate-400 font-semibold">
                              {appt.date} · {appt.time}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8F8F5] text-[#10B981]">
                            {appt.status || 'Confirmed'}
                          </span>
                          <button
                            type="button"
                            onClick={() => showToast(`Consultation started for ${appt.patientName || appt.name}`)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white text-xs font-semibold cursor-pointer shadow-xs"
                          >
                            Start Visit
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 4: MEDICAL RECORDS & EMR CHARTS
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'records' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Electronic Medical Records (EMR)</h2>
                    <p className="text-xs text-slate-500">Certified patient charts, allergies, clinical diagnoses, and encounter notes.</p>
                  </div>
                </div>

                {patients.length === 0 ? (
                  <div className="p-12 rounded-2xl bg-white border border-[#E7EEF4] text-center text-slate-400">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-[#17324D]">No Medical Records On File</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      Register a patient or create clinical documentation to view EMR charts here.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowNewPatientModal(true)}
                      className="mt-4 px-4 py-2 rounded-xl bg-[#0F9D9A] text-white text-xs font-semibold hover:bg-[#0D8B88] cursor-pointer"
                    >
                      + Register Patient
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {patients.map((p) => (
                      <div key={p.id} className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-[#17324D] text-base">{p.name}</h3>
                            <div className="text-xs text-slate-400 font-mono">MRN: {p.mrn} · {p.age} y · {p.gender}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              showToast(`Complete chart summary downloaded for ${p.name}`);
                            }}
                            className="px-3 py-1 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-400" />
                            <span>Export PDF</span>
                          </button>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Diagnosis:</span>
                            <span className="font-bold text-[#17324D]">{p.primaryDiagnosis}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Blood Pressure:</span>
                            <span className="font-bold text-slate-700">{p.bloodPressure}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Documented Allergies:</span>
                            <span className="font-bold text-amber-700">{p.allergies.join(', ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Encounter Status:</span>
                            <span className="font-bold text-emerald-600">Active Record</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedPatientForView(p)}
                          className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#17324D] font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Open Full Medical Chart
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 5: PRESCRIPTIONS & PHARMACY ORDERS
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'prescriptions' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Prescriptions &amp; Pharmacy Orders</h2>
                    <p className="text-xs text-slate-500">Authorize medication orders, dosage regimens, and electronic refill requests.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPatientForRx(patients[0]);
                      setShowPrescriptionModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Write Prescription</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {prescriptions.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white border border-[#E7EEF4] text-center text-slate-400">
                      <Pill className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700 text-sm">No electronic prescriptions issued</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Prescriptions authorized by physicians will immediately appear here and sync to patient records.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetPatientForRx(patients[0]);
                          setShowPrescriptionModal(true);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Write First Prescription</span>
                      </button>
                    </div>
                  ) : (
                    prescriptions.map((rx) => (
                      <div
                        key={rx.id}
                        className="p-4 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                            <Pill className="w-5 h-5 text-[#0F9D9A]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#17324D] text-sm">{rx.medication}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800">
                                {rx.dosage}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Patient: <strong className="text-slate-700">{rx.patientName}</strong> (MRN: {rx.patientMrn}) · {rx.frequency}
                            </p>
                            <span className="text-[11px] text-slate-400">
                              Prescribed: {rx.datePrescribed} · Duration: {rx.duration}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              rx.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {rx.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => showToast(`Refill confirmed for ${rx.medication}`)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                          >
                            Authorize Refill
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 6: LAB RESULTS & DIAGNOSTICS
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'lab' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Laboratory &amp; Pathology Results</h2>
                    <p className="text-xs text-slate-500">Review, validate, and electronically sign laboratory diagnostic reports.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOrderLabModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Order Lab Panel</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {labResults.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white border border-[#E7EEF4] text-center text-slate-400">
                      <FlaskConical className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700 text-sm">No laboratory diagnostic panels on record</p>
                      <p className="text-xs text-slate-400 mt-0.5">Order blood work or pathology panels to track patient biomarkers.</p>
                      <button
                        type="button"
                        onClick={() => setShowOrderLabModal(true)}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Order First Lab Panel</span>
                      </button>
                    </div>
                  ) : (
                    labResults.map((lab) => (
                      <div
                        key={lab.id}
                        className="p-4 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                            <FlaskConical className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#17324D] text-sm">{lab.testName}</span>
                              {lab.isAbnormal && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  Abnormal
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Patient: <strong className="text-slate-700">{lab.patientName}</strong> (MRN: {lab.patientMrn}) · Value:{' '}
                              <strong className="text-[#17324D]">{lab.value}</strong>
                            </p>
                            <span className="text-[11px] text-slate-400">
                              Reference Range: {lab.refRange} · Ordered: {lab.orderedDate}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setLabResults(
                                labResults.map((l) => (l.id === lab.id ? { ...l, status: 'Reviewed & Approved' } : l))
                              );
                              showToast(`Lab result for ${lab.patientName} signed and approved.`);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white text-xs font-semibold cursor-pointer shadow-xs"
                          >
                            Sign &amp; Approve
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 7: IMAGING & PACS STUDIES
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'imaging' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Radiological Imaging &amp; DICOM Viewer</h2>
                    <p className="text-xs text-slate-500">Thoracic low-dose CT scans, Sybil AI pulmonary nodule malignancy predictor.</p>
                  </div>
                  <Link
                    href="/lung-cancer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Launch AI DICOM Workstation</span>
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'study-01', patient: 'Vikram Patel', mrn: '100312', modality: 'Thoracic LDCT (Siemens SOMATOM)', slices: 384, aiRisk: '14.2% Malignancy (Low)', date: '09 Oct 2026' },
                    { id: 'study-02', patient: 'John Smith', mrn: '100245', modality: 'Chest Radiograph (PA & Lateral)', slices: 2, aiRisk: 'Normal lung parenchyma', date: '10 Oct 2026' },
                    { id: 'study-03', patient: 'Rahul Mehta', mrn: '100276', modality: 'High Resolution CT (HRCT)', slices: 512, aiRisk: 'Bronchial wall thickening', date: '05 Oct 2026' },
                  ].map((study) => (
                    <div key={study.id} className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-[#17324D] text-sm">{study.modality}</h4>
                          <span className="text-xs text-slate-500 font-medium">Patient: {study.patient} (MRN: {study.mrn})</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          {study.slices} Slices
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <span className="text-slate-400 block text-[10px]">AI Attributed Risk Assessment:</span>
                        <span className="font-bold text-[#17324D]">{study.aiRisk}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-400 text-[11px]">Acquired: {study.date}</span>
                        <Link
                          href="/lung-cancer"
                          className="px-3 py-1.5 rounded-xl bg-[#17324D] hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
                        >
                          <span>Open DICOM Slices</span>
                          <ExternalLink className="w-3 h-3 text-teal-400" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 8: BILLING & INSURANCE
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'billing' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Clinical Billing &amp; Insurance Verification</h2>
                    <p className="text-xs text-slate-500">ICD-10 clinical coding, CMS-1500 claim generation, and insurance co-pay clearance.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('New encounter invoice created.')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Invoice</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    { claimId: 'CLM-98201', patient: 'John Smith', insurer: 'BlueCross BlueShield PPO', amount: '$240.00', status: 'Cleared', date: '10 Oct 2026' },
                    { claimId: 'CLM-98202', patient: 'Priya Sharma', insurer: 'Aetna Open Access', amount: '$180.00', status: 'Pending Review', date: '08 Oct 2026' },
                    { claimId: 'CLM-98203', patient: 'Rahul Mehta', insurer: 'Medicare Part B', amount: '$310.00', status: 'Cleared', date: '05 Oct 2026' },
                  ].map((claim) => (
                    <div key={claim.claimId} className="p-4 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                          <CreditCard className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#17324D] text-sm">{claim.patient}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{claim.claimId}</span>
                          </div>
                          <p className="text-xs text-slate-500">{claim.insurer} · {claim.amount}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {claim.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 9: MESSAGES & COMMUNICATIONS
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'messages' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Clinical Team Communications</h2>
                    <p className="text-xs text-slate-500">Secure HIPAA messaging with nursing stations, labs, and patients.</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#E7EEF4] shadow-xs flex flex-col h-[520px]">
                  {/* Message Thread */}
                  <div className="flex-1 p-5 overflow-y-auto space-y-4">
                    {messages.map((m) => (
                      <div key={m.id} className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full ${m.avatarBg} flex items-center justify-center font-bold text-xs shrink-0`}>
                          {m.sender.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#17324D]">{m.sender}</span>
                            <span className="text-[10px] text-slate-400">{m.time}</span>
                          </div>
                          <p className="text-xs text-slate-700">{m.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Composer */}
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Type a clinical instruction or response..."
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-[#0F9D9A]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 10: PHYSICIAN TASKS & CHECKLIST
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'tasks' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Physician Daily Checklist</h2>
                    <p className="text-xs text-slate-500">Track and fulfill daily clinical obligations, rounds, and compliance reviews.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newTask: ClinicalTask = {
                        id: `t-${Date.now()}`,
                        title: 'Follow up with oncology review panel',
                        priority: 'Medium',
                        dueTime: '04:00 PM',
                        completed: false,
                      };
                      setTasks([...tasks, newTask]);
                      showToast('New clinical task created.');
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Task</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTask(task.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        task.completed
                          ? 'bg-slate-50/70 border-slate-200 opacity-60'
                          : 'bg-white border-[#E7EEF4] shadow-xs hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                            task.completed
                              ? 'bg-[#0F9D9A] border-[#0F9D9A] text-white'
                              : 'border-slate-300 hover:border-teal-500'
                          }`}
                        >
                          {task.completed && <Check className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${task.completed ? 'line-through text-slate-400' : 'text-[#17324D]'}`}>
                            {task.title}
                          </div>
                          {task.patientName && (
                            <div className="text-[11px] text-slate-400">Patient: {task.patientName}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] text-slate-400">Due: {task.dueTime}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            task.priority === 'High'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 11: PRACTICE ANALYTICS & DEMOGRAPHICS
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'analytics' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Practice Analytics &amp; Demographics</h2>
                    <p className="text-xs text-slate-500">Clinical volume, diagnostic throughput, and patient outcome demographics.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAnalyticsTimeframe('6m')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        analyticsTimeframe === '6m' ? 'bg-[#0F9D9A] text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Last 6 Months
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalyticsTimeframe('12m')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        analyticsTimeframe === '12m' ? 'bg-[#0F9D9A] text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Last 12 Months
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#17324D]">Patient Consultations</span>
                      <span className="text-[#10B981] font-bold">+18.4% YoY</span>
                    </div>
                    <div className="h-32 flex items-end justify-between gap-2 pt-4 px-1">
                      {[
                        { month: 'May', val: 45 },
                        { month: 'Jun', val: 58 },
                        { month: 'Jul', val: 52 },
                        { month: 'Aug', val: 68 },
                        { month: 'Sep', val: 74 },
                        { month: 'Oct', val: 82 },
                      ].map((bar, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                          <div
                            style={{ height: `${bar.val}%` }}
                            className="w-full rounded-t-md bg-gradient-to-t from-[#0F9D9A] to-[#2DD4BF] group-hover:brightness-110 transition-all"
                            title={`${bar.month}: ${bar.val} patients`}
                          />
                          <span className="text-[10px] text-slate-400 font-medium">{bar.month}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#17324D]">Appointment Distribution</span>
                      <span className="text-slate-400">Total: 48</span>
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                      <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-teal-500/20 p-2 shadow-inner">
                        <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-xs font-black text-[#17324D]">
                          48
                        </div>
                      </div>
                      <div className="flex-1 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Completed</span>
                          <span className="font-bold text-[#17324D]">32 (67%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Upcoming</span>
                          <span className="font-bold text-[#17324D]">12 (25%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Rescheduled</span>
                          <span className="font-bold text-[#17324D]">4 (8%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#17324D]">Demographics Split</span>
                      <span className="text-slate-400">248 Enrolled</span>
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                      <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-indigo-500/20 p-2 shadow-inner">
                        <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-xs font-black text-[#17324D]">
                          248
                        </div>
                      </div>
                      <div className="flex-1 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Female</span>
                          <span className="font-bold text-[#17324D]">134 (54%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Male</span>
                          <span className="font-bold text-[#17324D]">114 (46%)</span>
                        </div>
                        <div className="text-[11px] text-slate-400 pt-1">
                          Avg. Patient Age: 44.8 years
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 12: CLINIC SETTINGS & PREFERENCES
               ══════════════════════════════════════════════════════════ */}
            {activeNav === 'settings' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#17324D]">Physician Profile &amp; Clinic Preferences</h2>
                    <p className="text-xs text-slate-500">Adjust paging thresholds, electronic signature defaults, and notifications.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('Clinic preferences saved successfully.')}
                    className="px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    Save Preferences
                  </button>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-[#E7EEF4] shadow-xs space-y-5 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-[#17324D]">Urgent Clinical Paging (Critical Alerts)</div>
                      <div className="text-slate-400">Receive priority push alerts when anaphylactoid reactions or systolic BP &gt; 160 mmHg occurs.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettingsUrgentPaging(!settingsUrgentPaging)}
                      className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                        settingsUrgentPaging ? 'bg-[#0F9D9A]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settingsUrgentPaging ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-[#17324D]">Automated Normal Lab Routing</div>
                      <div className="text-slate-400">Pre-approve normal lipid and thyroid panels within standard biological reference ranges.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettingsAutoSignLabs(!settingsAutoSignLabs)}
                      className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                        settingsAutoSignLabs ? 'bg-[#0F9D9A]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settingsAutoSignLabs ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-[#17324D]">SMS Appointment Reminders</div>
                      <div className="text-slate-400">Send 24-hour and 2-hour text notifications to patients before outpatient clinic visits.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettingsSmsAlerts(!settingsSmsAlerts)}
                      className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                        settingsSmsAlerts ? 'bg-[#0F9D9A]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settingsSmsAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="pt-2 text-slate-500">
                    <div><strong>Physician Licensing:</strong> {attendingDoctorName} · Internal Medicine Lead</div>
                    <div><strong>Affiliation:</strong> CareNest Hospital &amp; Medical Network · NPI: 1849201948</div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ==============================================================
          MODAL 1: VIEW PATIENT PROFILE & MEDICAL CHART
         ============================================================== */}
      {selectedPatientForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E7EEF4] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${selectedPatientForView.avatarBg} flex items-center justify-center font-bold text-sm`}>
                  {selectedPatientForView.initials}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17324D]">{selectedPatientForView.name}</h3>
                  <p className="text-xs text-slate-400 MRN: {selectedPatientForView.mrn} · {selectedPatientForView.age} years old ({selectedPatientForView.gender})">MRN: {selectedPatientForView.mrn} · {selectedPatientForView.age} years old ({selectedPatientForView.gender})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatientForView(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#F8FAFD] border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-medium">Primary Condition:</span>
                  <span className="font-bold text-[#17324D]">{selectedPatientForView.primaryDiagnosis}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Latest Blood Pressure:</span>
                  <span className="font-bold text-[#17324D]">{selectedPatientForView.bloodPressure}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Contact Phone:</span>
                  <span className="font-medium text-slate-700">{selectedPatientForView.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Known Allergies:</span>
                  <span className="font-bold text-amber-800">{selectedPatientForView.allergies.join(', ')}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-100 text-teal-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0F9D9A]" />
                  <span>Next Clinical Appointment</span>
                </div>
                <p className="text-[11px] text-teal-800">
                  Scheduled for <strong>{selectedPatientForView.nextAppointment} at {selectedPatientForView.nextAppointmentTime}</strong> with {attendingDoctorName}.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    showToast(`Clinical summary exported for ${selectedPatientForView.name}`);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Export Chart
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetPatientForRx(selectedPatientForView);
                    setSelectedPatientForView(null);
                    setShowPrescriptionModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold shadow-xs cursor-pointer"
                >
                  Write Prescription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL 2: REGISTER NEW PATIENT
         ============================================================== */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7EEF4] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-50 text-[#0F9D9A]">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#17324D]">Register New Patient</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPatientModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPatientSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Samuel Henderson"
                  value={newPatient.name}
                  onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Age</label>
                  <input
                    type="number"
                    placeholder="e.g. 48"
                    value={newPatient.age}
                    onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Gender</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as 'M' | 'F' })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  >
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Primary Diagnosis or Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Routine Pulmonary Evaluation"
                  value={newPatient.diagnosis}
                  onChange={(e) => setNewPatient({ ...newPatient, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="(555) 012-3456"
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Appointment Time</label>
                  <input
                    type="text"
                    placeholder="11:30 AM"
                    value={newPatient.nextTime}
                    onChange={(e) => setNewPatient({ ...newPatient, nextTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold shadow-xs cursor-pointer"
                >
                  Register Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL 3: WRITE & AUTHORIZE PRESCRIPTION
         ============================================================== */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7EEF4] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-50 text-[#0F9D9A]">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17324D]">New Electronic Prescription</h3>
                  <p className="text-[11px] text-slate-400">
                    Patient: {targetPatientForRx?.name || 'Selected Patient'} (MRN: {targetPatientForRx?.mrn || 'N/A'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPrescriptionSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Medication Name</label>
                <input
                  type="text"
                  placeholder="e.g. Amoxicillin / Lisinopril / Metformin"
                  value={newRx.medication}
                  onChange={(e) => setNewRx({ ...newRx, medication: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Dosage &amp; Form</label>
                <input
                  type="text"
                  placeholder="e.g. 500 mg Oral Capsule"
                  value={newRx.dosage}
                  onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Frequency</label>
                  <select
                    value={newRx.frequency}
                    onChange={(e) => setNewRx({ ...newRx, frequency: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  >
                    <option value="Once daily with meals">Once daily with meals</option>
                    <option value="Twice daily morning and night">Twice daily</option>
                    <option value="Every 8 hours as needed">Every 8 hrs PRN</option>
                    <option value="Bedtime only">Bedtime only</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Duration &amp; Refills</label>
                  <input
                    type="text"
                    placeholder="30 days (1 refill)"
                    value={newRx.duration}
                    onChange={(e) => setNewRx({ ...newRx, duration: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-100 text-[11px] text-teal-800">
                Authorized by <strong>{attendingDoctorName}</strong> (DEA/NPI verified). Direct Surescripts electronic routing enabled.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPrescriptionModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold shadow-xs cursor-pointer"
                >
                  Transmit &amp; Authorize Rx
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL 4: BOOK APPOINTMENT
         ============================================================== */}
      {showBookAppointmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7EEF4] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-50 text-[#0F9D9A]">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17324D]">Schedule Clinical Appointment</h3>
                  <p className="text-[11px] text-slate-400">Syncs immediately to Doctor &amp; Patient Portals</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBookAppointmentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookAppointmentSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Patient</label>
                <select
                  value={newApptForm.patientId}
                  onChange={(e) => setNewApptForm({ ...newApptForm, patientId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (MRN: {p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date</label>
                  <input
                    type="date"
                    value={newApptForm.date}
                    onChange={(e) => setNewApptForm({ ...newApptForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Time</label>
                  <input
                    type="text"
                    placeholder="11:00 AM"
                    value={newApptForm.time}
                    onChange={(e) => setNewApptForm({ ...newApptForm, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Consultation Type</label>
                <select
                  value={newApptForm.type}
                  onChange={(e) => setNewApptForm({ ...newApptForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                >
                  <option value="In-Clinic Consultation">In-Clinic Consultation</option>
                  <option value="Teleconsult Video Visit">Teleconsult Video Visit</option>
                  <option value="Pulmonary Function Assessment">Pulmonary Function Assessment</option>
                  <option value="Diagnostic Review">Diagnostic Review</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Clinical Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Please bring current health records"
                  value={newApptForm.instructions}
                  onChange={(e) => setNewApptForm({ ...newApptForm, instructions: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBookAppointmentModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold shadow-xs cursor-pointer"
                >
                  Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL 5: ORDER LAB DIAGNOSTIC PANEL
         ============================================================== */}
      {showOrderLabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7EEF4] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17324D]">Order Laboratory Diagnostic</h3>
                  <p className="text-[11px] text-slate-400">Pathology &amp; Clinical Blood Work Order</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderLabModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOrderLabSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Patient</label>
                <select
                  value={newLabForm.patientId}
                  onChange={(e) => setNewLabForm({ ...newLabForm, patientId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (MRN: {p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Diagnostic Test Name</label>
                <input
                  type="text"
                  placeholder="e.g. Hemoglobin A1c (HbA1c) / CMP / Lipid Panel"
                  value={newLabForm.testName}
                  onChange={(e) => setNewLabForm({ ...newLabForm, testName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Result Value</label>
                  <input
                    type="text"
                    placeholder="e.g. 5.9 %"
                    value={newLabForm.value}
                    onChange={(e) => setNewLabForm({ ...newLabForm, value: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Reference Range</label>
                  <input
                    type="text"
                    placeholder="< 5.7 %"
                    value={newLabForm.refRange}
                    onChange={(e) => setNewLabForm({ ...newLabForm, refRange: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="lab-abnormal-chk"
                  checked={newLabForm.isAbnormal}
                  onChange={(e) => setNewLabForm({ ...newLabForm, isAbnormal: e.target.checked })}
                  className="rounded border-slate-300 text-[#0F9D9A] focus:ring-[#0F9D9A]"
                />
                <label htmlFor="lab-abnormal-chk" className="text-slate-700 font-semibold cursor-pointer">
                  Flag as Abnormal / Clinical Attention Required
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowOrderLabModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Authorize Lab Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
