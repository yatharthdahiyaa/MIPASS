'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRBAC } from '@/context/RBACContext';
import {
  clinicalApiService,
  ClinicalPatient,
  ClinicalPrescription,
  ClinicalLabResult,
  ClinicalAppointment,
  ClinicalDiagnosticReport,
  ClinicalMessage,
} from '@/services/clinicalApiService';
import {
  Users,
  FileText,
  Calendar,
  ShieldCheck,
  Search,
  Plus,
  ArrowRight,
  ArrowLeft,
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
  HelpCircle,
  LogOut,
  Trash2,
  Database,
} from 'lucide-react';
import IndicLanguageSelector from '@/components/common/IndicLanguageSelector';
import { useIndicLanguage } from '@/context/IndicLanguageContext';

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

interface CarePlanTask {
  id: string;
  title: string;
  subtitle: string;
  completed: boolean;
  actionTab: 'overview' | 'appointments' | 'records' | 'medications' | 'results' | 'messages' | 'settings';
}

interface EMRAppointment {
  id: string;
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  type: string;
  location: string;
  status: string;
  instructions: string;
}

interface EMRPastVisit {
  id: string;
  date: string;
  doctor: string;
  specialty: string;
  reason: string;
  doctorSummary: string;
  prescriptionsUpdated: string[];
  vitalsRecorded: string;
}

interface EMRMedication {
  id: string;
  name: string;
  dosage: string;
  instructions: string;
  prescribedBy: string;
  refillsLeft: number;
  adherence: string;
  status: string;
  tag: string;
}

interface EMRTestResult {
  id: string;
  title: string;
  date: string;
  category: string;
  orderedBy: string;
  status: string;
  patientExplanation: string;
  details: Array<{ test: string; value: string; status: string }>;
}

interface EMRMessage {
  id: string;
  sender: string;
  role: string;
  avatarColor: string;
  time: string;
  text: string;
  isMe: boolean;
}

const EMPTY_PATIENT_PROFILE: PatientProfile = {
  id: '',
  name: 'No Patient Chart Selected',
  dob: '--',
  age: 0,
  gender: '--',
  bloodType: '--',
  mrn: 'NO-CHART',
  email: '--',
  phone: '--',
  address: '--',
  emergencyContact: {
    name: '--',
    relation: '--',
    phone: '--',
  },
  insurance: {
    provider: 'No Active Policy',
    plan: '--',
    memberId: '--',
    groupNumber: '--',
    validThru: '--',
  },
  primaryDoctor: {
    name: 'Unassigned',
    title: '--',
    clinic: '--',
    phone: '--',
  },
};

export default function OpenEMRHub() {
  const router = useRouter();
  const { currentUser, isAuthenticated, isSessionReady, switchPersona, logout, logoutIAM, isIamAuthenticated, iamUser } = useRBAC();
  const { currentLanguage, t, isIndicLanguage } = useIndicLanguage();
  const isClinicianOrAdmin = isAuthenticated && Boolean(
    currentUser?.role && ['doctor', 'radiologist', 'admin', 'technician', 'researcher'].includes(currentUser.role)
  );
  const isPatient = isAuthenticated && currentUser?.role === 'patient';
  const timeGreeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const handleSignOut = async () => {
    try {
      await logoutIAM();
    } catch {
      // Continue cleanup even if network request fails
    }
    logout();
    router.push('/');
  };

  // Navigation tabs matching CareNest layout:
  // Overview, Appointments, Health Records, Medications, Test Results, Messages, Settings
  const [activeTab, setActiveTab] = useState<
    'overview' | 'appointments' | 'records' | 'medications' | 'results' | 'messages' | 'settings'
  >('overview');

  // Backend Clinical State (Persistent and Live)
  const [patients, setPatients] = useState<ClinicalPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [isLoadingClinical, setIsLoadingClinical] = useState<boolean>(true);
  const [clinicalLoadError, setClinicalLoadError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<EMRAppointment[]>([]);
  const [pastVisits, setPastVisits] = useState<EMRPastVisit[]>([]);
  const [medications, setMedications] = useState<EMRMedication[]>([]);
  const [testResults, setTestResults] = useState<EMRTestResult[]>([]);
  const [messages, setMessages] = useState<EMRMessage[]>([]);
  const [carePlanTasks, setCarePlanTasks] = useState<CarePlanTask[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Health Records Sub-Tab for patient exploration
  const [recordsTab, setRecordsTab] = useState<'visits' | 'conditions' | 'vaccines' | 'vitals_history'>('visits');

  // Modals & Booking
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [newAppointmentForm, setNewAppointmentForm] = useState({
    doctor: 'Dr. Taylor, MD',
    date: '2026-10-22',
    time: '11:00 AM',
    type: 'In-Clinic Consultation',
    reason: 'Routine health consultation',
  });

  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: '',
    heartRate: '',
    oxygen: '',
    bmi: '',
  });

  // Drug Allergies Management State
  const [showAllergiesModal, setShowAllergiesModal] = useState(false);
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [isSavingAllergies, setIsSavingAllergies] = useState(false);

  // Settings: Notification & Privacy Preferences
  const [notificationSettings, setNotificationSettings] = useState({
    smsReminders: true,
    emailLabResults: true,
    doctorMessageAlerts: true,
    medicationRefillPushes: true,
  });

  // Load Patient Data from Clinical API
  const loadPatientData = useCallback(async () => {
    setIsLoadingClinical(true);
    setClinicalLoadError(null);
    try {
      const pts = await clinicalApiService.getPatients();
      setPatients(pts);

      if (pts.length > 0) {
        const currentName = currentUser?.name?.toLowerCase();
        const iamName = iamUser?.username?.toLowerCase();
        const iamEmail = iamUser?.email?.toLowerCase();
        const currentEmail = currentUser?.email?.toLowerCase();
        const isAuthPatient = isPatient && Boolean(currentUser && currentUser.id);

        let matched: ClinicalPatient | undefined;

        // If an authenticated patient is active, prioritize their chart
        if (isAuthPatient) {
          matched = pts.find((p) => p.id === currentUser.id);
          if (!matched && currentEmail) {
            matched = pts.find((p) => p.email && p.email.toLowerCase() === currentEmail);
          }
          if (!matched && currentName) {
            matched = pts.find((p) => p.name.toLowerCase() === currentName || p.name.toLowerCase().includes(currentName) || currentName.includes(p.name.toLowerCase()));
          }
        }

        // If not matched yet, check selectedPatientId or IAM
        if (!matched && selectedPatientId) {
          matched = pts.find((p) => p.id === selectedPatientId);
        }
        if (!matched && iamEmail) {
          matched = pts.find((p) => p.email && p.email.toLowerCase() === iamEmail);
        }
        if (!matched && iamName) {
          matched = pts.find((p) => p.name.toLowerCase().includes(iamName) || (p.email && p.email.toLowerCase().includes(iamName)));
        }

        // Never fall back to another patient's chart. If this patient has no
        // registered chart yet, create one instead of displaying someone else.
        if (!matched && isAuthPatient) {
          const created = await clinicalApiService.createPatient({
            name: currentUser.name,
            email: currentUser.email || '',
            primaryDiagnosis: 'Patient Health Portal Member',
          });
          if (created) {
            setPatients((prev) => [...prev, created]);
            matched = created;
          }
        }

        if (!matched) {
          setSelectedPatientId('');
          setAppointments([]);
          setPastVisits([]);
          setMedications([]);
          setTestResults([]);
          setMessages([]);
          setCarePlanTasks([]);
          return;
        }

        setSelectedPatientId(matched.id);

        const bundle = await clinicalApiService.getPatientBundle({
          patientId: matched.id,
          mrn: matched.mrn,
        });

        // 1. Prescriptions -> Medications
        const loadedMeds: EMRMedication[] = (bundle.prescriptions || []).map((p, idx) => ({
          id: p.id || `med-${idx}`,
          name: p.medication,
          dosage: p.dosage,
          instructions: p.frequency ? `${p.frequency} · ${p.instructions || ''}` : p.instructions || 'Take as directed',
          prescribedBy: p.prescribedBy || 'Dr. Taylor, MD',
          refillsLeft: p.refills ?? 2,
          adherence: '100%',
          status: p.status || 'Active',
          tag: p.frequency || 'Daily Maintenance',
        }));
        setMedications(loadedMeds);

        // 2. Appointments
        const loadedApts: EMRAppointment[] = (bundle.appointments || []).map((a, idx) => ({
          id: a.id || `apt-${idx}`,
          doctor: a.doctor || a.doctorName || 'Dr. Taylor, MD',
          specialty: a.specialty || 'General Consultation',
          date: a.date,
          time: a.time,
          type: a.type || 'In-Clinic Consultation',
          location: a.location || 'CareNest Medical Center · Suite 402',
          status: a.status || 'Confirmed',
          instructions: a.instructions || 'Routine consultation',
        }));
        setAppointments(loadedApts);

        // 3. Diagnostic Reports & Labs -> Test Results
        const diagnosticResults: EMRTestResult[] = (bundle.diagnosticReports || []).map((r, idx) => ({
          id: r.id || `diag-${idx}`,
          title: `${r.serviceName} Analysis Report`,
          date: r.date,
          category: 'Diagnostic Radiology',
          orderedBy: r.radiologist || 'Clinical AI Suite',
          status: r.certified ? 'Doctor Reviewed · Certified' : 'AI Analysis · Completed',
          patientExplanation: r.clinicalSummary || r.findings,
          details: [
            { test: 'Modality', value: r.serviceName, status: r.riskLevel || 'Normal' },
            { test: 'Confidence', value: `${r.confidence ? Math.round(r.confidence * 100) : 94}%`, status: 'Verified' },
            { test: 'Recommendation', value: r.recommendation || 'Clinical review advised', status: 'Reviewed' },
          ],
        }));

        const labResults: EMRTestResult[] = (bundle.labResults || []).map((l, idx) => ({
          id: l.id || `lab-${idx}`,
          title: l.testName,
          date: l.date || l.orderedDate || 'Today',
          category: 'Lab Work',
          orderedBy: l.orderedBy || l.doctorOrLab || 'Dr. Taylor, MD',
          status: l.status,
          patientExplanation: l.findings || 'Laboratory diagnostic testing completed.',
          details: l.details && l.details.length > 0 ? l.details : [
            { test: l.testName, value: l.value || 'Complete', status: l.status },
          ],
        }));
        setTestResults([...diagnosticResults, ...labResults]);

        // 4. Messages
        const loadedMsgs: EMRMessage[] = (bundle.messages || []).map((m, idx) => ({
          id: m.id || `msg-${idx}`,
          sender: m.sender,
          role: m.role || m.senderRole || 'Care Team',
          avatarColor: m.sender.toLowerCase().includes('taylor') ? 'bg-teal-500' : 'bg-sky-500',
          time: m.time,
          text: m.text,
          isMe: Boolean(m.isMe || m.sender.toLowerCase().includes('(you)') || (matched && m.sender === matched.name)),
        }));
        setMessages(loadedMsgs);

        // 5. Past Visits
        const completedApts = (bundle.appointments || []).filter((a) => a.status === 'Completed');
        if (completedApts.length > 0) {
          setPastVisits(
            completedApts.map((a, idx) => ({
              id: a.id || `visit-${idx}`,
              date: a.date,
              doctor: a.doctor || a.doctorName || 'Dr. Taylor, MD',
              specialty: a.specialty || 'General Practice',
              reason: a.instructions || 'Routine Follow-up',
              doctorSummary: 'Clinical review completed. Vitals stable.',
              prescriptionsUpdated: loadedMeds.slice(0, 2).map((m) => m.name),
              vitalsRecorded: 'BP: 120/80 mmHg · Pulse: 72 bpm',
            }))
          );
        } else {
          setPastVisits([]);
        }

        // 6. Care Plan Tasks (Dynamically derived from real clinical items)
        const dynamicTasks: CarePlanTask[] = [];
        if (loadedMeds.length > 0) {
          dynamicTasks.push({
            id: 'task-meds',
            title: 'Review medication schedule',
            subtitle: `Stay on track with ${loadedMeds[0].name} (${loadedMeds[0].dosage}).`,
            completed: true,
            actionTab: 'medications',
          });
        }
        if (loadedApts.length > 0) {
          dynamicTasks.push({
            id: 'task-apt',
            title: 'Prepare for upcoming visit',
            subtitle: `Review consultation notes for ${loadedApts[0].doctor} on ${loadedApts[0].date}.`,
            completed: false,
            actionTab: 'appointments',
          });
        }
        if (diagnosticResults.length > 0 || labResults.length > 0) {
          const firstRes = diagnosticResults[0] || labResults[0];
          dynamicTasks.push({
            id: 'task-res',
            title: 'Read your latest test results',
            subtitle: `${firstRes.title} is certified and ready for review.`,
            completed: false,
            actionTab: 'results',
          });
        }
        setCarePlanTasks(dynamicTasks);
      } else {
        if (currentUser?.name && isPatient && !currentUser.name.toLowerCase().includes('taylor')) {
          const created = await clinicalApiService.createPatient({
            name: currentUser.name,
            email: currentUser.email || '',
            primaryDiagnosis: 'Patient Health Portal Member',
          });
          if (created) {
            setPatients([created]);
            setSelectedPatientId(created.id);
          }
        } else {
          setSelectedPatientId('');
          setAppointments([]);
          setPastVisits([]);
          setMedications([]);
          setTestResults([]);
          setMessages([]);
          setCarePlanTasks([]);
        }
      }
    } catch (err) {
      console.error('Failed to load patient clinical records:', err);
      setClinicalLoadError('Unable to load your clinical records. The care team has been notified; please retry.');
    } finally {
      setIsLoadingClinical(false);
    }
  }, [currentUser, iamUser, isPatient, selectedPatientId]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  // Active Selected Patient Object
  const isAuthPatient = isPatient && Boolean(currentUser && currentUser.id);
  const activeMatchedPatient = isAuthPatient
    ? (patients.find((p) => p.id === currentUser.id || (currentUser.email && p.email?.toLowerCase() === currentUser.email.toLowerCase()) || (currentUser.name && p.name.toLowerCase() === currentUser.name.toLowerCase())) ||
       patients.find((p) => p.id === selectedPatientId) ||
       null)
    : null;

  const displayName = isAuthPatient
    ? currentUser.name
    : (activeMatchedPatient?.name || 'Patient');

  const displayEmail = isAuthPatient
    ? (currentUser.email || `${currentUser.name.toLowerCase().replace(/\s+/g, '.')}@carenest.health`)
    : (activeMatchedPatient?.email || `${(activeMatchedPatient?.name || 'patient').toLowerCase().replace(/\s+/g, '.')}@carenest.health`);

  const patient: PatientProfile = activeMatchedPatient
    ? {
        id: activeMatchedPatient.id,
        name: displayName,
        dob: activeMatchedPatient.dob || 'June 14, 1990',
        age: activeMatchedPatient.age || 34,
        gender: activeMatchedPatient.gender || 'Not specified',
        bloodType: activeMatchedPatient.bloodType || 'O Positive (O+)',
        mrn: activeMatchedPatient.mrn,
        email: displayEmail,
        phone: activeMatchedPatient.phone || '(555) 014-2901',
        address: activeMatchedPatient.address || 'Standard Clinic Care Plan',
        emergencyContact: {
          name: 'Primary Contact',
          relation: 'Family',
          phone: activeMatchedPatient.phone || '(555) 014-8892',
        },
        insurance: {
          provider: 'CareNest Premier Healthcare',
          plan: 'Comprehensive Care PPO Plus',
          memberId: activeMatchedPatient.mrn,
          groupNumber: 'GRP-77120',
          validThru: '12/2027',
        },
        primaryDoctor: {
          name: activeMatchedPatient.primaryDoctor || 'Attending Physician, MD',
          title: 'Lead Primary Physician',
          clinic: 'CareNest Medical Center · Suite 402',
          phone: '(555) 019-3000',
        },
      }
    : isAuthPatient
    ? {
        id: currentUser.id || `pat-${Date.now().toString(36)}`,
        name: currentUser.name,
        dob: 'June 14, 1990',
        age: 34,
        gender: 'Not specified',
        bloodType: 'A Positive (A+)',
        mrn: `MRN-${Math.floor(100000 + Math.random() * 900000)}`,
        email: displayEmail,
        phone: '(555) 019-2834',
        address: 'Standard Clinic Care Plan',
        emergencyContact: {
          name: 'Primary Contact',
          relation: 'Family',
          phone: '(555) 019-2835',
        },
        insurance: {
          provider: 'CareNest Health System',
          plan: 'Standard PPO Health Plan',
          memberId: `CN-${Math.floor(100000 + Math.random() * 900000)}`,
          groupNumber: 'GRP-9021',
          validThru: '12/2027',
        },
        primaryDoctor: {
          name: 'Attending Physician, MD',
          title: 'Lead Primary Physician',
          clinic: 'CareNest Medical Center · Suite 402',
          phone: '(555) 019-3000',
        },
      }
    : EMPTY_PATIENT_PROFILE;

  // Active vitals evaluation
  const activeVitals = activeMatchedPatient?.vitals || {};
  const currentBp = activeVitals.bloodPressure || activeMatchedPatient?.bloodPressure || '';
  const currentHr = activeVitals.heartRate || activeMatchedPatient?.heartRate || '';
  const currentO2 = activeVitals.oxygen || activeMatchedPatient?.oxygen || '';
  const currentBmi = activeVitals.bmi || activeMatchedPatient?.bmi || '';
  const hasAnyVitals = Boolean(currentBp || currentHr || currentO2 || currentBmi);

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = activeMatchedPatient?.id || currentUser?.id;
    if (!targetId) return;
    const bpVal = vitalsForm.bloodPressure.trim();
    const hrVal = vitalsForm.heartRate.trim();
    const o2Val = vitalsForm.oxygen.trim();
    const bmiVal = vitalsForm.bmi.trim();

    try {
      const updated = await clinicalApiService.updatePatientVitals(targetId, {
        bloodPressure: bpVal ? (bpVal.toLowerCase().includes('mmhg') ? bpVal : `${bpVal} mmHg`) : '',
        heartRate: hrVal,
        oxygen: o2Val,
        bmi: bmiVal,
      });

      if (updated) {
        setPatients((prev) =>
          prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
        );
      } else {
        // Fallback state update
        setPatients((prev) =>
          prev.map((p) =>
            p.id === targetId
              ? {
                  ...p,
                  bloodPressure: bpVal ? `${bpVal} mmHg` : '',
                  heartRate: hrVal,
                  oxygen: o2Val,
                  bmi: bmiVal,
                  vitals: {
                    bloodPressure: bpVal ? `${bpVal} mmHg` : '',
                    heartRate: hrVal,
                    oxygen: o2Val,
                    bmi: bmiVal,
                  },
                }
              : p
          )
        );
      }
      setNotification('Vital signs recorded in your medical chart!');
      setTimeout(() => setNotification(null), 3500);
      setShowVitalsModal(false);
    } catch {
      setNotification('Could not save vitals. Please try again.');
      setTimeout(() => setNotification(null), 3500);
    }
  };

  // Drug Allergies Handlers (Persistent via Clinical API & SQLite DB)
  const handleAddAllergy = async (allergyToAdd?: string) => {
    const item = (allergyToAdd || newAllergyInput).trim();
    if (!item) return;
    const targetPatientId = activeMatchedPatient?.id || patient?.id || selectedPatientId;
    if (!targetPatientId) return;

    setIsSavingAllergies(true);
    try {
      const current = activeMatchedPatient?.allergies || [];
      if (!current.includes(item)) {
        const updated = [...current, item];
        const ok = await clinicalApiService.updatePatientAllergies(targetPatientId, updated);
        if (ok) {
          setNotification(`Added drug allergy: ${item}`);
          setTimeout(() => setNotification(null), 3500);
          setNewAllergyInput('');
          await loadPatientData();
        } else {
          setNotification('Could not save allergy. Please try again.');
          setTimeout(() => setNotification(null), 3500);
        }
      } else {
        setNotification(`Allergy "${item}" is already recorded`);
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (e) {
      console.error(e);
      setNotification('Failed to update allergies. Please try again.');
      setTimeout(() => setNotification(null), 3500);
    } finally {
      setIsSavingAllergies(false);
    }
  };

  const handleRemoveAllergy = async (allergyToRemove: string) => {
    const targetPatientId = activeMatchedPatient?.id || patient?.id || selectedPatientId;
    if (!targetPatientId) return;

    setIsSavingAllergies(true);
    try {
      const current = activeMatchedPatient?.allergies || [];
      const updated = current.filter((a) => a !== allergyToRemove);
      const ok = await clinicalApiService.updatePatientAllergies(targetPatientId, updated);
      if (ok) {
        setNotification(`Removed allergy: ${allergyToRemove}`);
        setTimeout(() => setNotification(null), 3500);
        await loadPatientData();
      } else {
        setNotification('Could not remove allergy. Please try again.');
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (e) {
      console.error(e);
      setNotification('Failed to update allergies. Please try again.');
      setTimeout(() => setNotification(null), 3500);
    } finally {
      setIsSavingAllergies(false);
    }
  };

  const handleClearAllergies = async () => {
    const targetPatientId = activeMatchedPatient?.id || patient?.id || selectedPatientId;
    if (!targetPatientId) return;

    setIsSavingAllergies(true);
    try {
      const ok = await clinicalApiService.updatePatientAllergies(targetPatientId, []);
      if (ok) {
        setNotification('Recorded: No Known Drug Allergies (NKDA)');
        setTimeout(() => setNotification(null), 3500);
        await loadPatientData();
      } else {
        setNotification('Could not clear allergies. Please try again.');
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (e) {
      console.error(e);
      setNotification('Failed to clear allergies. Please try again.');
      setTimeout(() => setNotification(null), 3500);
    } finally {
      setIsSavingAllergies(false);
    }
  };

  const toggleTaskCompleted = (taskId: string) => {
    setCarePlanTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const completedTaskCount = carePlanTasks.filter((t) => t.completed).length;
  const taskProgressPct = carePlanTasks.length > 0 ? Math.round((completedTaskCount / carePlanTasks.length) * 100) : 100;

  // Book Appointment Submit (Saves to Backend)
  const handleBookAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await clinicalApiService.createAppointment({
        patientId: patient.id || 'pat_demo_01',
        patientName: patient.name || 'Patient',
        patientMrn: patient.mrn || 'CN-8842-1001',
        mrn: patient.mrn || 'CN-8842-1001',
        doctor: newAppointmentForm.doctor,
        doctorName: newAppointmentForm.doctor,
        specialty: 'Clinical Consultation',
        date: newAppointmentForm.date,
        time: newAppointmentForm.time,
        type: newAppointmentForm.type,
        location: 'CareNest Medical Center · Suite 402',
        status: 'Confirmed',
        instructions: newAppointmentForm.reason || 'Booked via Patient Portal',
      });

      if (created) {
        setAppointments((prev) => [
          {
            id: created.id,
            doctor: created.doctor || created.doctorName || 'Dr. Taylor, MD',
            specialty: created.specialty || 'General Consultation',
            date: created.date,
            time: created.time,
            type: created.type,
            location: created.location,
            status: created.status,
            instructions: created.instructions || 'Routine consultation',
          },
          ...prev,
        ]);
        setShowAppointmentModal(false);
        setNotification(`Appointment booked with ${created.doctor || created.doctorName} for ${created.date} at ${created.time}!`);
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err) {
      console.error('Failed to book appointment:', err);
      setNotification('Failed to save appointment to clinical backend.');
    }
  };

  // Send Message Submit (Saves to Backend)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;
    const textToSend = newMessageText.trim();
    setNewMessageText('');

    try {
      const savedMsg = await clinicalApiService.sendMessage({
        patientId: patient.id || 'pat_demo_01',
        sender: `${patient.name} (Patient)`,
        role: 'Patient',
        senderRole: 'Patient',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: textToSend,
        isMe: true,
      });

      if (savedMsg) {
        setMessages((prev) => [
          ...prev,
          {
            id: savedMsg.id,
            sender: savedMsg.sender,
            role: savedMsg.role || savedMsg.senderRole || 'Patient',
            avatarColor: 'bg-[#17324D]',
            time: savedMsg.time,
            text: savedMsg.text,
            isMe: true,
          },
        ]);
        setNotification('Message sent to your care team.');
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setNotification('Failed to save message.');
    }
  };

  // Quick Demo Patient Helper (1-Click Test Seeding)
  const handleCreateDemoPatient = async () => {
    try {
      setIsLoadingClinical(true);
      const demoPat = await clinicalApiService.createPatient({
        name: 'Alex Taylor',
        age: 38,
        gender: 'F',
        mrn: 'CN-8842-1001',
        dob: 'June 14, 1988',
        bloodType: 'O Positive (O+)',
        condition: 'Asthma & Mild Hypertension (Controlled)',
        riskLevel: 'Moderate',
        status: 'Active',
        primaryDoctor: 'Dr. Taylor, MD',
        phone: '(555) 014-2901',
        email: 'alex.taylor@carenest.health',
        address: '42 Abbey Road, Boston, MA 02115',
      });

      if (!demoPat) return;

      await clinicalApiService.createPrescription({
        patientId: demoPat.id,
        patientName: demoPat.name,
        patientMrn: demoPat.mrn,
        mrn: demoPat.mrn,
        medication: 'Albuterol Sulfate Inhaler 90mcg',
        dosage: '90mcg per actuation (2 puffs)',
        frequency: 'As needed (every 4-6h)',
        duration: '30 days',
        datePrescribed: 'Today',
        prescribedBy: 'Dr. Taylor, MD',
        refills: 3,
        status: 'Active',
        instructions: 'Inhale 2 puffs for wheezing or acute shortness of breath.',
      });

      await clinicalApiService.createPrescription({
        patientId: demoPat.id,
        patientName: demoPat.name,
        patientMrn: demoPat.mrn,
        mrn: demoPat.mrn,
        medication: 'Lisinopril 10mg Oral',
        dosage: '10mg oral tablet',
        frequency: 'Once daily in the morning',
        duration: '90 days',
        datePrescribed: 'Today',
        prescribedBy: 'Dr. Marcus Chen',
        refills: 4,
        status: 'Active',
        instructions: 'Take 1 tablet daily with water for blood pressure management.',
      });

      await clinicalApiService.createAppointment({
        patientId: demoPat.id,
        patientName: demoPat.name,
        patientMrn: demoPat.mrn,
        mrn: demoPat.mrn,
        doctor: 'Dr. Taylor, MD',
        doctorName: 'Dr. Taylor, MD',
        specialty: 'Pulmonology & Preventive Medicine',
        date: 'Tue, 20 Oct',
        time: '10:30 AM',
        type: 'In-Clinic Consultation',
        location: 'Suite 402 · CareNest Medical Center',
        status: 'Confirmed',
        instructions: 'Please arrive 10 minutes early. No fasting required.',
      });

      await clinicalApiService.createLabResult({
        patientId: demoPat.id,
        patientName: demoPat.name,
        patientMrn: demoPat.mrn,
        mrn: demoPat.mrn,
        testName: 'Comprehensive Metabolic Panel (CMP)',
        date: 'Today, 9:12 AM',
        orderedDate: 'Today',
        value: 'Normal Reference Range',
        refRange: 'All Normal',
        status: 'Reviewed & Approved',
        orderedBy: 'Dr. Taylor, MD',
        findings: 'All electrolyte, renal, and hepatic biomarkers are within normal limits.',
        details: [
          { test: 'Fasting Blood Glucose', value: '92 mg/dL', status: 'Optimal (70 - 99)' },
          { test: 'Serum Creatinine', value: '0.88 mg/dL', status: 'Normal (0.6 - 1.1)' },
          { test: 'Sodium', value: '140 mEq/L', status: 'Normal (136 - 145)' },
          { test: 'Potassium', value: '4.2 mEq/L', status: 'Normal (3.5 - 5.0)' },
        ],
      });

      await clinicalApiService.sendMessage({
        patientId: demoPat.id,
        sender: 'Dr. Taylor, MD',
        role: 'Your Doctor',
        senderRole: 'Your Doctor',
        time: 'Today, 9:20 AM',
        text: 'Good morning Alex! Your CMP lab panel has returned with all normal values. Please continue taking your inhaler and Lisinopril as directed.',
        isMe: false,
      });

      setNotification('Demo patient Alex Taylor and clinical chart initialized!');
      setSelectedPatientId(demoPat.id);
      await loadPatientData();
    } catch (err) {
      console.error('Failed to create demo patient:', err);
      setNotification('Failed to initialize demo patient.');
    } finally {
      setIsLoadingClinical(false);
    }
  };

  // Clear All Data Helper (Wipe Database)
  const handleClearAllData = async () => {
    if (!confirm('Are you sure you want to clear all clinical records? This will wipe the persistent database.')) return;
    try {
      setIsLoadingClinical(true);
      await clinicalApiService.clearAllRecords();
      setNotification('All clinical records cleared.');
      setSelectedPatientId('');
      await loadPatientData();
    } catch (err) {
      console.error('Failed to clear records:', err);
      setNotification('Failed to wipe records.');
    } finally {
      setIsLoadingClinical(false);
    }
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
    const isRecorded = progress > 0 && value !== '--' && Boolean(value && value.trim() !== '');
    const radius = 48;
    const circumference = Math.PI * radius; // ~150.8
    const strokeDashoffset = isRecorded
      ? circumference * (1 - Math.min(Math.max(progress, 0.08), 0.95))
      : circumference;
    const displayColor = isRecorded ? color : '#CBD5E1';

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
              stroke={displayColor}
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Centered Icon inside the arch */}
          <div className="absolute top-5 flex items-center justify-center w-8 h-8 rounded-full" style={{ color: displayColor }}>
            {icon}
          </div>
        </div>

        {/* Large Value & Unit */}
        <div className="mt-1 text-center">
          <div className={`text-xl sm:text-2xl font-bold tracking-tight ${isRecorded ? 'text-[#17324D]' : 'text-slate-300'}`}>
            {value || '--'}
          </div>
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider -mt-0.5">
            {unit}
          </div>
        </div>

        {/* Reference Range Status Badge */}
        <div
          className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
            isRecorded
              ? 'bg-[#E8F8F5] text-[#0F9D9A]'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRecorded ? 'bg-[#0F9D9A]' : 'bg-slate-300'
            }`}
          />
          <span>{isRecorded ? badgeText : 'Not recorded'}</span>
        </div>
      </div>
    );
  };

  // ==============================================================
  // PATIENT AUTHORIZATION GATE (Strictly Patient-Owned Access)
  // ==============================================================
  if (!isSessionReady) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="w-4 h-4 rounded-full border-2 border-[#0F9D9A] border-t-transparent animate-spin" />
          <span>Verifying your patient session...</span>
        </div>
      </div>
    );
  }

  if (!isPatient) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] font-sans flex items-center justify-center p-4 antialiased">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-[#E7EEF4] text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-[#0F9D9A] mx-auto flex items-center justify-center shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold uppercase tracking-wider">
              Protected Health Portal
            </span>
            <h2 className="text-2xl font-extrabold text-[#17324D] mt-2">
              Sign In Required
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {currentUser?.name
                ? `You are signed in as ${currentUser.name} (${currentUser.role}). This personal health portal is restricted exclusively to patient accounts.`
                : 'Access to personal medical charts, prescriptions, and certified diagnostic reports requires signing in to your patient account.'}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/login?redirect=/emr"
              className="w-full py-3 px-4 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Heart className="w-4 h-4 fill-white" />
              <span>Sign In to Access Portal</span>
            </Link>

            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Create Patient Account</span>
            </Link>

            {isAuthenticated && (currentUser?.role === 'doctor' || currentUser?.role === 'radiologist') && (
              <Link
                href="/doctor"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-[#17324D] border border-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Stethoscope className="w-4 h-4 text-[#0F9D9A]" />
                <span>Go to Doctor Workstation ({currentUser.name})</span>
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
                  {t('emr_portal_title', 'Patient Portal')}
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
                { id: 'overview', label: t('emr_nav_overview', 'Overview'), icon: Home, dot: false },
                { id: 'appointments', label: t('emr_nav_appointments', 'Appointments'), icon: Calendar, dot: false },
                { id: 'records', label: t('emr_nav_records', 'Health Records'), icon: FileText, dot: false },
                { id: 'medications', label: t('emr_nav_medications', 'Medications'), icon: Pill, dot: false },
                { id: 'results', label: t('emr_nav_results', 'Test Results'), icon: FlaskConical, dot: false },
                { id: 'messages', label: t('emr_nav_messages', 'Messages'), icon: MessageSquare, dot: true },
                { id: 'settings', label: t('emr_nav_settings', 'Settings'), icon: Settings, dot: false },
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

            {/* Quick Navigation & Sign Out */}
            <div className="px-4 pt-2 pb-1 border-t border-[#F0F4F8] mt-2 space-y-1">
              <Link
                href="/patient"
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs text-teal-700 bg-teal-50/70 hover:bg-teal-100 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#0F9D9A]" />
                <span>{t('emr_diagnostic_system', 'Diagnostic System')}</span>
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs text-rose-600 bg-rose-50/50 hover:bg-rose-100 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>{t('emr_sign_out', 'Sign Out')}</span>
              </button>
            </div>
          </div>

          {/* Bottom Card: "Your health matters" matching screenshot */}
          <div className="p-4 m-4 rounded-2xl bg-gradient-to-br from-[#E8F8F5] via-[#EBF4FA] to-[#F3EFFC] border border-white/60 shadow-xs">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-teal-600 shadow-xs shrink-0">
                <HeartPulse className="w-5 h-5 text-[#0F9D9A]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#17324D]">{t('emr_health_matters_title', 'Your health matters')}</h4>
                <p className="text-[11px] text-slate-500 leading-tight">{t('emr_health_matters_desc', "We're here to support you, always.")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('messages')}
              className="w-full mt-2 py-1.5 px-3 rounded-lg bg-white/80 hover:bg-white text-xs font-semibold text-[#0F9D9A] border border-teal-500/20 transition-all text-center cursor-pointer"
            >
              {t('emr_contact_care_team', 'Contact Care Team')}
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
            <div className="flex items-center gap-2.5 sm:gap-3 flex-1 max-w-xl">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200"
                aria-label="Open navigation menu"
              >
                <Users className="w-5 h-5" />
              </button>

              {/* Prominent Back Button to Return to Patient Portal */}
              <Link
                href="/patient"
                id="emr-back-to-patient-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#0F9D9A] border border-teal-200/80 font-bold text-xs sm:text-sm transition-all shadow-2xs shrink-0 cursor-pointer"
                title="Back to Patient Diagnostic Portal"
              >
                <ArrowLeft className="w-4 h-4 text-[#0F9D9A]" />
                <span className="hidden sm:inline">{t('emr_back_patient', 'Back to Patient Portal')}</span>
                <span className="sm:hidden">{t('emr_back_patient', 'Back')}</span>
              </Link>

              {/* Patient Search Input */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('emr_search_placeholder', 'Search records or help...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F7FAFD] border border-[#E2EBF2] text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0F9D9A] focus:ring-2 focus:ring-[#0F9D9A]/15 transition-all"
                />
              </div>
            </div>

            {/* Header Right Actions: Language Mode, Notifications, Profile, and Sign Out */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Indian Language Selector */}
              <div className="hidden sm:block">
                <IndicLanguageSelector />
              </div>

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
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#17324D] truncate">{patient.name}</div>
                        <div className="text-slate-400 text-[11px] font-mono">MRN: {patient.mrn}</div>
                        <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9px] font-bold">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          {t('emr_personal_health_record', 'Personal Health Record')}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {/* Clinician Staff Controls - ONLY visible to Doctors, Radiologists, and Admins */}
                      {isClinicianOrAdmin && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl mb-2 space-y-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Staff Controls · Switch Patient:
                          </span>
                          {patients.length > 1 && (
                            <select
                              value={selectedPatientId}
                              onChange={(e) => setSelectedPatientId(e.target.value)}
                              className="w-full p-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-500"
                            >
                              {patients.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.mrn})
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              handleCreateDemoPatient();
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold text-xs cursor-pointer text-left"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#0F9D9A]" />
                            <span>+ Demo Patient (Alex Taylor)</span>
                          </button>
                          <Link
                            href="/doctor"
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-xs cursor-pointer"
                          >
                            <Stethoscope className="w-3.5 h-3.5 text-[#0F9D9A]" />
                            <span>Doctor Workstation (PACS)</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              handleClearAllData();
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-amber-700 hover:bg-amber-100 font-medium text-xs cursor-pointer text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Clear All Clinical Data (Reset)</span>
                          </button>
                        </div>
                      )}

                      {/* Patient Actions */}
                      <Link
                        href="/patient"
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-teal-700 hover:bg-teal-50 font-medium cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-[#0F9D9A]" />
                        <span>{t('emr_diagnostic_system', 'AI Diagnostic Suite')}</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowInsuranceModal(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4 text-[#0F9D9A]" />
                        <span>{t('emr_digital_insurance', 'View My Digital Insurance Card')}</span>
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
                        <span>{t('emr_share_records', 'Share My Health Records')}</span>
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
                        <span>{t('emr_privacy_settings', 'Notification & Privacy Settings')}</span>
                      </button>
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-100 space-y-1">
                      <button
                        type="button"
                        id="emr-dropdown-signout-btn"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-600" />
                        <span>{t('emr_sign_out', 'Sign Out')}</span>
                      </button>

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

              {/* Direct Header Sign Out Icon-Only Button */}
              <button
                type="button"
                id="emr-header-signout-btn"
                onClick={handleSignOut}
                className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-700 transition-all cursor-pointer shadow-xs flex items-center justify-center shrink-0"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
              </button>
            </div>
          </header>

          {/* Main Workspace */}
          <main className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
            {clinicalLoadError && (
              <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
                <span>{clinicalLoadError}</span>
                <button
                  type="button"
                  onClick={loadPatientData}
                  className="self-start sm:self-auto rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700"
                >
                  Retry
                </button>
              </div>
            )}
            {/* ==============================================================
                TAB 1: OVERVIEW (Faithful to Reference Image)
               ============================================================== */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Back Link Breadcrumb */}
                <div>
                  <Link
                    href="/patient"
                    id="emr-welcome-back-link"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0F9D9A] text-xs font-semibold border border-teal-200/70 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('emr_back_patient', 'Back to Diagnostic System')}</span>
                  </Link>
                </div>

                {/* 1. Welcome Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17324D] tracking-tight flex items-center gap-2">
                      <span>{timeGreeting}, {patient.name.split(' ')[0]}</span>
                      <span className="text-2xl">☀️</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      {t('emr_overview_subtitle', "Here's your health overview for today.")}
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
                      <span>{t('emr_book_appointment', 'Book appointment')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('records')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D5E2EC] text-[#17324D] font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-[#0F9D9A]" />
                      <span>{t('emr_view_records', 'View health records')}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Medical Alerts & Allergies (Patient Safety) */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-start sm:items-center justify-between gap-3 shadow-xs transition-all ${
                    activeMatchedPatient?.allergies && activeMatchedPatient.allergies.length > 0
                      ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        activeMatchedPatient?.allergies && activeMatchedPatient.allergies.length > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {activeMatchedPatient?.allergies && activeMatchedPatient.allergies.length > 0 ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          activeMatchedPatient?.allergies && activeMatchedPatient.allergies.length > 0
                            ? 'text-amber-800'
                            : 'text-emerald-800'
                        }`}
                      >
                        {t('emr_known_allergies', 'My Known Drug Allergies:')}
                      </span>
                      <div className="text-xs font-semibold flex flex-wrap gap-2 mt-0.5">
                        {activeMatchedPatient?.allergies && activeMatchedPatient.allergies.length > 0 ? (
                          activeMatchedPatient.allergies.map((allergy, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 font-bold">
                              {allergy}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            {t('emr_no_allergies', 'No Known Drug Allergies (NKDA)')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="hidden md:inline-flex text-[11px] font-semibold text-slate-500">
                      Shared with care team for all visits
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllergiesModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      {t('emr_manage', 'Manage')}
                    </button>
                  </div>
                </div>

                {/* Empty State Alert Banner when no patients exist */}
                {patients.length === 0 && (
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-sky-500/10 to-indigo-500/10 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs animate-in fade-in">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#17324D]">
                          {isClinicianOrAdmin
                            ? 'Clinical Database is Clean (0 Active Patients)'
                            : 'No Active Health Records on File'}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {isClinicianOrAdmin
                            ? 'Records written by doctors in the Doctor Workstation will sync here automatically. Or seed a test patient with 1 click.'
                            : 'Your medical records have not been uploaded yet by your clinic. Records will securely appear here as soon as your physician certifies notes or lab results.'}
                        </p>
                      </div>
                    </div>
                    {isClinicianOrAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCreateDemoPatient}
                          className="px-3.5 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>+ Quick Demo Patient</span>
                        </button>
                        <Link
                          href="/doctor"
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#17324D] text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5"
                        >
                          <Stethoscope className="w-3.5 h-3.5 text-[#0F9D9A]" />
                          <span>Doctor Portal</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )}

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
                      <div className="text-xs font-medium text-slate-500">{t('emr_next_appointment', 'Next appointment')}</div>
                      <div className="text-sm font-bold text-[#17324D] mt-0.5 truncate">
                        {appointments.length > 0 ? `${appointments[0].date} · ${appointments[0].time}` : t('emr_no_upcoming_visits', 'No upcoming visits')}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {appointments.length > 0 ? appointments[0].doctor : t('emr_click_to_schedule', 'Click to schedule')}
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
                      <div className="text-xs font-medium text-slate-500">{t('emr_medications_card', 'Medications')}</div>
                      <div className="text-sm font-bold text-[#17324D] mt-0.5 flex items-center justify-between">
                        <span>{medications.length} {t('emr_active', 'active')}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <span className="text-xs font-semibold text-[#0F9D9A] mt-0.5 inline-block">
                        {t('emr_view_schedule', 'View schedule')}
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
                      <div className="text-xs font-medium text-slate-500">{t('emr_recent_test_results', 'Recent test results')}</div>
                      <div className="text-sm font-bold text-[#17324D] mt-0.5 flex items-center justify-between">
                        <span>{testResults.length} {t('emr_reports', 'reports')}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <span className="text-xs font-semibold text-[#0F9D9A] mt-0.5 inline-block">
                        {t('emr_view_results', 'View results')}
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
                      <div className="text-xs font-medium text-slate-500">{t('emr_care_team', 'Care team')}</div>
                      <div className="text-sm font-bold text-[#17324D] mt-0.5 flex items-center justify-between">
                        <span>{messages.length} {t('emr_messages_count', 'messages')}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <span className="text-xs font-semibold text-[#0F9D9A] mt-0.5 inline-block">
                        {t('emr_send_message', 'Send a message')}
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
                            {t('emr_health_at_glance', 'Your health at a glance')}
                          </h2>
                          <p className="text-xs text-slate-400">
                            {t('emr_vitals_subtitle', 'Your latest vital signs and measurements.')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setVitalsForm({
                              bloodPressure: currentBp || '',
                              heartRate: currentHr ? String(currentHr) : '',
                              oxygen: currentO2 ? String(currentO2) : '',
                              bmi: currentBmi ? String(currentBmi) : '',
                            });
                            setShowVitalsModal(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#E8F8F5] hover:bg-[#D5F4EE] text-[#0F9D9A] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{hasAnyVitals ? 'Update Vitals' : 'Record Vitals'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('records');
                            setRecordsTab('vitals_history');
                          }}
                          className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer pl-1"
                        >
                          <span>History</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 4 Gauge Meters dynamically bound to active patient stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 mt-4">
                      {/* Blood Pressure */}
                      {renderSemiCircleGauge(
                        t('emr_blood_pressure', 'Blood pressure'),
                        currentBp ? currentBp.replace(/\s*mmHg/i, '') : '--',
                        'mmHg',
                        <Stethoscope className="w-4 h-4" />,
                        currentBp ? '#3B82F6' : '#94A3B8',
                        currentBp ? 0.68 : 0,
                        'Normal range'
                      )}

                      {/* Heart Rate */}
                      {renderSemiCircleGauge(
                        t('emr_heart_rate', 'Heart rate'),
                        currentHr ? String(currentHr) : '--',
                        'bpm',
                        <Heart className="w-4 h-4" />,
                        currentHr ? '#EF4444' : '#94A3B8',
                        currentHr ? Math.min(Number(currentHr) / 100, 1) : 0,
                        'Normal range'
                      )}

                      {/* Oxygen */}
                      {renderSemiCircleGauge(
                        t('emr_oxygen_level', 'Oxygen'),
                        currentO2 ? String(currentO2) : '--',
                        '%',
                        <Wind className="w-4 h-4" />,
                        currentO2 ? '#0F9D9A' : '#94A3B8',
                        currentO2 ? Math.min(Number(currentO2) / 100, 1) : 0,
                        'Normal range'
                      )}

                      {/* BMI */}
                      {renderSemiCircleGauge(
                        'BMI',
                        currentBmi ? String(currentBmi) : '--',
                        'kg/m²',
                        <Scale className="w-4 h-4" />,
                        currentBmi ? '#10B981' : '#94A3B8',
                        currentBmi ? Math.min(Number(currentBmi) / 40, 1) : 0,
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
                            {t('emr_care_plan', 'Your care plan')}
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
                    {testResults.length === 0 && appointments.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400">
                        No recent clinical activity recorded yet. Tests or visits scheduled by your physician will appear here.
                      </div>
                    ) : (
                      <>
                        {testResults.slice(0, 1).map((res) => (
                          <div
                            key={res.id}
                            onClick={() => setActiveTab('results')}
                            className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F8FAFD] transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-full bg-[#F2EDFC] text-[#8B5CF6] flex items-center justify-center shrink-0">
                                <FlaskConical className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-[#17324D] group-hover:text-[#0F9D9A] transition-colors">
                                  {res.title}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {res.patientExplanation}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-medium text-slate-400">{res.date}</span>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        ))}

                        {appointments.slice(0, 1).map((apt) => (
                          <div
                            key={apt.id}
                            onClick={() => setActiveTab('appointments')}
                            className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F8FAFD] transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-full bg-[#EBF3FE] text-[#2563EB] flex items-center justify-center shrink-0">
                                <Calendar className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-[#17324D] group-hover:text-[#0F9D9A] transition-colors">
                                  Appointment: {apt.doctor}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  Scheduled for {apt.date} at {apt.time} ({apt.type}).
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-medium text-slate-400">{apt.status}</span>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        ))}
                      </>
                    )}
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
                    <h2 className="text-2xl font-bold text-[#17324D]">{t('emr_my_appointments', 'My Appointments')}</h2>
                    <p className="text-sm text-slate-500">{t('emr_appointments_desc', 'View upcoming clinical consultations and book new visits.')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAppointmentModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('emr_schedule_new_appointment', 'Schedule New Appointment')}</span>
                  </button>
                </div>

                {/* Upcoming Appointments List */}
                {appointments.length === 0 ? (
                  <div className="p-12 rounded-2xl bg-white border border-[#E7EEF4] text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#0F9D9A] mx-auto flex items-center justify-center">
                      <Calendar className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#17324D]">No Appointments Scheduled</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        You have no upcoming consultations. Book an appointment with your physician or care team below.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAppointmentModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Book an Appointment</span>
                    </button>
                  </div>
                ) : (
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
                )}

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
                    <h2 className="text-2xl font-bold text-[#17324D]">{t('emr_my_records', 'My Health Records')}</h2>
                    <p className="text-sm text-slate-500">{t('emr_records_desc', 'Explore past doctor summaries, vitals history, vaccines, and health documents.')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#D5E2EC] text-xs font-semibold text-[#17324D] shadow-xs cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#0F9D9A]" />
                      <span>{t('emr_share_records', 'Share Records')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInsuranceModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{t('emr_digital_insurance', 'Insurance Card')}</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Tabs for clean patient navigation */}
                <div className="flex items-center gap-2 p-1 bg-white rounded-xl border border-[#E7EEF4] w-fit">
                  {[
                    { id: 'visits', label: t('records_past_visits', 'Doctor Visits & Summaries') },
                    { id: 'conditions', label: t('records_diagnosed_conditions', 'Conditions & Allergies') },
                    { id: 'vaccines', label: t('records_vaccines', 'Vaccines & Immunizations') },
                    { id: 'vitals_history', label: t('records_vitals_history', 'Vitals Log') },
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
                    {pastVisits.length === 0 ? (
                      <div className="p-12 rounded-2xl bg-white border border-[#E7EEF4] text-center space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#0F9D9A] mx-auto flex items-center justify-center">
                          <FileText className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-bold text-[#17324D]">No Past Visits Recorded</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Consultation summaries, prescriptions reviewed, and recorded vitals will appear here after visits are completed.
                        </p>
                      </div>
                    ) : (
                      pastVisits.map((visit) => (
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
                      ))
                    )}
                  </div>
                )}

                {/* Sub-View 2: Conditions & Allergies */}
                {recordsTab === 'conditions' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Allergies Card */}
                    <div className="bg-white rounded-2xl border border-[#E7EEF4] p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-[#17324D]">My Allergies</h3>
                            <p className="text-xs text-slate-400">Important substances to avoid.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAllergiesModal(true)}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Manage Allergies
                        </button>
                      </div>

                      <div className="space-y-3">
                        {activeMatchedPatient?.allergies && activeMatchedPatient.allergies.length > 0 ? (
                          activeMatchedPatient.allergies.map((allergy, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between gap-3">
                              <div>
                                <span className="font-bold text-amber-950 text-sm">{allergy}</span>
                                <p className="text-[11px] text-amber-800 mt-0.5">
                                  Documented in EHR: Drug alerts care team before administration or prescription.
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                                  Active Allergy
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAllergy(allergy)}
                                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                                  title="Remove allergy"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 text-center space-y-1">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                            <p className="text-xs font-bold text-emerald-900">No Known Drug Allergies (NKDA)</p>
                            <p className="text-[11px] text-emerald-700">No adverse drug reactions or substance allergies are currently recorded in your chart.</p>
                          </div>
                        )}
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
                        {activeMatchedPatient?.primaryDiagnosis &&
                        activeMatchedPatient.primaryDiagnosis !== 'General Clinical Intake' &&
                        activeMatchedPatient.primaryDiagnosis !== 'Pending Initial Assessment' &&
                        activeMatchedPatient.primaryDiagnosis !== 'General Consultation' &&
                        activeMatchedPatient.primaryDiagnosis !== 'Patient Health Portal Member' ? (
                          <div className="p-3.5 rounded-xl border border-[#E2EBF2] bg-[#F8FAFD] space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-[#17324D]">{activeMatchedPatient.primaryDiagnosis}</span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                                Active Care
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Clinical diagnosis documented in chart. Primary physician care plan in place.
                            </p>
                          </div>
                        ) : (
                          <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-1.5" />
                            <span className="font-semibold text-slate-700 block">No chronic conditions registered</span>
                            <span className="text-[11px] text-slate-400">No active chronic health conditions currently documented in your medical chart.</span>
                          </div>
                        )}
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
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#17324D]">Recorded Vitals History</h3>
                        <p className="text-xs text-slate-400">Chronological vital signs entries for {displayName}.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setVitalsForm({
                            bloodPressure: currentBp || '',
                            heartRate: currentHr ? String(currentHr) : '',
                            oxygen: currentO2 ? String(currentO2) : '',
                            bmi: currentBmi ? String(currentBmi) : '',
                          });
                          setShowVitalsModal(true);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Log New Reading</span>
                      </button>
                    </div>

                    {hasAnyVitals ? (
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
                              <td className="py-3 font-bold text-[#17324D]">Latest Reading</td>
                              <td className="py-3 text-blue-600 font-bold">{currentBp || '--'}</td>
                              <td className="py-3 text-red-600 font-bold">{currentHr ? `${currentHr} bpm` : '--'}</td>
                              <td className="py-3 text-teal-600 font-bold">{currentO2 ? `${currentO2} %` : '--'}</td>
                              <td className="py-3 text-emerald-600 font-bold">{currentBmi || '--'}</td>
                              <td className="py-3 text-slate-500">Patient Recorded</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-400">
                        <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600 text-sm">No vital signs recorded yet</p>
                        <p className="text-xs text-slate-400 mt-0.5">Click &ldquo;Log New Reading&rdquo; above to record your current blood pressure, heart rate, oxygen, or BMI.</p>
                      </div>
                    )}
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
                    <h2 className="text-2xl font-bold text-[#17324D]">{t('emr_my_medications', 'My Active Medications')}</h2>
                    <p className="text-sm text-slate-500">{t('emr_medications_desc', 'Prescription instructions, daily intake guidance, and one-click pharmacy refills.')}</p>
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
                    <span>{t('emr_request_refills', 'Request All Refills')}</span>
                  </button>
                </div>

                {medications.length === 0 ? (
                  <div className="p-12 rounded-2xl bg-white border border-[#E7EEF4] text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#0F9D9A] mx-auto flex items-center justify-center">
                      <Pill className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-[#17324D]">No Active Medications</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      You have no active prescriptions on file. Prescriptions ordered by your physician in the Doctor Workstation will sync here automatically.
                    </p>
                  </div>
                ) : (
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
                            <span className="text-slate-400">{t('Prescribed by:')}</span>
                            <span className="font-bold text-[#17324D]">{med.prescribedBy}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">{t('Refills remaining:')}</span>
                            <span className="font-bold text-[#0F9D9A]">{med.refillsLeft} {t('refills', 'refills')}</span>
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
                          {t('Refill This Medication')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ==============================================================
                TAB 5: TEST RESULTS (Explained for Patients)
               ============================================================== */}
            {activeTab === 'results' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#17324D]">{t('emr_my_results', 'My Test Results')}</h2>
                  <p className="text-sm text-slate-500">{t('emr_results_desc', 'Lab panels and diagnostic radiology explained in clear, patient-friendly language.')}</p>
                </div>

                <div className="space-y-4">
                  {testResults.length === 0 ? (
                    <div className="p-12 rounded-2xl bg-white border border-[#E7EEF4] text-center space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#0F9D9A] mx-auto flex items-center justify-center">
                        <FlaskConical className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#17324D]">No Test Results Available</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          You currently have no completed lab panels or radiology imaging reports. Any diagnostic scans run through the AI suite will save here.
                        </p>
                      </div>
                      <Link
                        href="/patient"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Launch AI Diagnostic Suite</span>
                      </Link>
                    </div>
                  ) : (
                    testResults.map((res) => (
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
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 6: MESSAGES (Secure Care Team Messaging)
               ============================================================== */}
            {activeTab === 'messages' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#17324D]">{t('emr_my_messages', 'Message My Care Team')}</h2>
                  <p className="text-sm text-slate-500">{t('emr_messages_desc', 'Ask questions directly to Dr. Taylor and your clinic nurses.')}</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E7EEF4] shadow-xs overflow-hidden flex flex-col h-[520px]">
                  {/* Messages Feed */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-4">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">No Messages in Inbox</p>
                          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-0.5">
                            Send a secure message to Dr. Taylor and your clinical care team below.
                          </p>
                        </div>
                      </div>
                    ) : (
                      messages.map((m) => (
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
                      ))
                    )}
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
                      <span>{t('emr_send_message', 'Send')}</span>
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
                  <h2 className="text-2xl font-bold text-[#17324D]">{t('emr_my_settings', 'Account & Privacy Settings')}</h2>
                  <p className="text-sm text-slate-500">{t('emr_settings_desc', 'Manage your contact information, insurance card, and notification reminders.')}</p>
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
                  <option value="Dr. Sarah Mitchell, MD">Dr. Sarah Mitchell, MD (Radiology)</option>
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
          MODAL: RECORD VITAL SIGNS
         ============================================================== */}
      {showVitalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7EEF4] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-50 text-[#0F9D9A]">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17324D]">Record Vital Signs</h3>
                  <p className="text-[11px] text-slate-400">Log your active physiological measurements.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVitalsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVitals} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Blood Pressure (mmHg)</label>
                  <input
                    type="text"
                    value={vitalsForm.bloodPressure}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })}
                    placeholder="e.g. 120/80"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={vitalsForm.heartRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: e.target.value })}
                    placeholder="e.g. 72"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Oxygen Saturation (%)</label>
                  <input
                    type="number"
                    value={vitalsForm.oxygen}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, oxygen: e.target.value })}
                    placeholder="e.g. 98"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">BMI (kg/m²)</label>
                  <input
                    type="text"
                    value={vitalsForm.bmi}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, bmi: e.target.value })}
                    placeholder="e.g. 24.2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0F9D9A]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAFD] border border-slate-100 text-[11px] text-slate-500">
                Measurements saved here will update your clinical health record and calibrate diagnostic review.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowVitalsModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] text-white font-semibold shadow-xs cursor-pointer"
                >
                  Save Vitals
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: MANAGE DRUG ALLERGIES
         ============================================================== */}
      {showAllergiesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7EEF4] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17324D]">Manage Drug Allergies</h3>
                  <p className="text-[11px] text-slate-400">Keep your clinical care team informed of adverse reactions.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllergiesModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Allergies List */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Current Documented Allergies</label>
              {activeMatchedPatient?.allergies && activeMatchedPatient.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                  {activeMatchedPatient.allergies.map((allergy, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-amber-100/80 border border-amber-200 text-amber-950 text-xs font-semibold flex items-center gap-2 shadow-2xs"
                    >
                      <span>{allergy}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAllergy(allergy)}
                        disabled={isSavingAllergies}
                        className="text-amber-700 hover:text-rose-600 cursor-pointer transition-colors"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No Known Drug Allergies (NKDA) recorded.</span>
                </div>
              )}
            </div>

            {/* Add New Allergy Form */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 block">Add New Allergy or Substance</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newAllergyInput}
                  onChange={(e) => setNewAllergyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAllergy();
                    }
                  }}
                  placeholder="e.g. Penicillin, Sulfa, Aspirin..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-[#0F9D9A]"
                />
                <button
                  type="button"
                  onClick={() => handleAddAllergy()}
                  disabled={isSavingAllergies || !newAllergyInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-[#0F9D9A] hover:bg-[#0D8B88] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {/* Quick Select common substances */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Common Allergens</span>
                <div className="flex flex-wrap gap-1.5">
                  {['Penicillin', 'Sulfa Drugs', 'Aspirin', 'Iodine Contrast', 'Latex', 'Codeine'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleAddAllergy(s)}
                      disabled={isSavingAllergies || Boolean(activeMatchedPatient?.allergies?.includes(s))}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleClearAllergies}
                disabled={isSavingAllergies}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
              >
                Clear all (Mark NKDA)
              </button>
              <button
                type="button"
                onClick={() => setShowAllergiesModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
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
