'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  FileText,
  Calendar,
  Share2,
  ShieldCheck,
  Search,
  Plus,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Code,
  Copy,
  RefreshCw,
  UserCheck,
  Stethoscope,
  HeartPulse,
  ChevronRight,
  ChevronDown,
  Activity,
  Layers,
  FileCheck,
  Printer,
  Edit,
  ClipboardList,
  Eye,
  Sliders,
  Maximize2,
  Lock,
  Sun,
  Moon,
  Building2,
  Check,
  X,
  UserPlus,
  Flame,
  Pill,
  Thermometer,
  ShieldAlert,
  FolderOpen
} from 'lucide-react';
import {
  openemrService,
  OpenEMRPatient,
  OpenEMRUser,
  OpenEMREncounter,
  OpenEMRProcedureOrder,
} from '@/services/openemrService';

interface ExtendedPatient extends OpenEMRPatient {
  medications?: string[];
  vitals?: {
    bp: string;
    pulse: number;
    resp: number;
    temp_f: number;
    spo2: number;
    weight_kg: number;
    height_cm: number;
    bmi: number;
    date: string;
  };
  primary_provider?: string;
  insurance_provider?: string;
}

const DEFAULT_PATIENTS: ExtendedPatient[] = [
  {
    id: 'pat_001',
    pid: 1001,
    pubpid: 'MRN-8842-1001',
    fname: 'Eleanor',
    lname: 'Rigby',
    dob: '1962-04-12',
    sex: 'Female',
    phone_home: '(555) 014-2901',
    street: '42 Abbey Road, Apt 4B',
    city: 'Boston',
    state: 'MA',
    postal_code: '02115',
    status: 'Active',
    allergies: ['Penicillin (Anaphylactoid)', 'IV Iodine Contrast (Moderate Pruritus)'],
    chronic_conditions: ['COPD (Gold Stage II)', 'Tobacco Use Disorder (35 pack-years)', 'Primary Hypertension'],
    medications: ['Albuterol Inhaler 90mcg Q4H PRN', 'Tiotropium 18mcg Inhaled Daily', 'Lisinopril 10mg PO Daily'],
    primary_provider: 'Dr. Elena Vance, MD',
    insurance_provider: 'Mass General Brigham Health Plan #MB-88192',
    clinical_notes: 'Under active annual LDCT screening protocol. Monitored for right upper lobe spiculated nodule.',
    vitals: {
      bp: '128/82 mmHg',
      pulse: 74,
      resp: 16,
      temp_f: 98.6,
      spo2: 96,
      weight_kg: 68.2,
      height_cm: 164,
      bmi: 25.4,
      date: '2026-10-13 08:30 EDT',
    },
  },
  {
    id: 'pat_002',
    pid: 1002,
    pubpid: 'MRN-5512-1002',
    fname: 'John',
    lname: 'Doe',
    dob: '1968-11-23',
    sex: 'Male',
    phone_home: '(555) 018-8832',
    street: '100 Main Street, Suite 200',
    city: 'Cambridge',
    state: 'MA',
    postal_code: '02138',
    status: 'Active',
    allergies: ['Sulfa Drugs (Erythema)'],
    chronic_conditions: ['Hypertension', 'Hyperlipidemia'],
    medications: ['Amlodipine 5mg PO Daily', 'Atorvastatin 20mg PO QHS'],
    primary_provider: 'Dr. Marcus Chen, MD',
    insurance_provider: 'Blue Cross Blue Shield #BC-44129',
    clinical_notes: 'Presented with acute persistent cough and right-sided pleuritic chest discomfort.',
    vitals: {
      bp: '136/88 mmHg',
      pulse: 82,
      resp: 18,
      temp_f: 99.1,
      spo2: 98,
      weight_kg: 84.5,
      height_cm: 178,
      bmi: 26.7,
      date: '2026-10-13 09:00 EDT',
    },
  },
  {
    id: 'pat_003',
    pid: 1003,
    pubpid: 'MRN-3199-1003',
    fname: 'Robert',
    lname: 'Davis',
    dob: '1984-03-15',
    sex: 'Male',
    phone_home: '(555) 019-3312',
    street: '15 Commonwealth Ave',
    city: 'Boston',
    state: 'MA',
    postal_code: '02116',
    status: 'Active',
    allergies: ['NKDA (No Known Drug Allergies)'],
    chronic_conditions: ['Routine Occupational Health Baseline'],
    medications: ['Multivitamin Daily'],
    primary_provider: 'Dr. Elena Vance, MD',
    insurance_provider: 'Harvard Pilgrim Health Care #HP-11209',
    clinical_notes: 'Annual executive occupational health baseline radiograph screening.',
    vitals: {
      bp: '120/78 mmHg',
      pulse: 68,
      resp: 14,
      temp_f: 98.4,
      spo2: 99,
      weight_kg: 76.0,
      height_cm: 182,
      bmi: 22.9,
      date: '2026-10-13 10:15 EDT',
    },
  },
];

const DEFAULT_ORDERS: OpenEMRProcedureOrder[] = [
  {
    procedure_order_id: 'ord_001',
    provider_id: 'usr_001',
    patient_id: 'pat_001',
    mrn: 'MRN-8842-1001',
    modality: 'CT',
    procedure_code: '71271',
    procedure_name: 'Low-Dose CT Thorax Screening',
    clinical_indication: 'Annual screening in high-risk smoker. Evaluate apical solid nodule progression.',
    order_priority: 'URGENT',
    order_status: 'in_progress',
    dicom_accession_number: 'ACC-2026-0941',
    linked_job_id: 'MIP-9902-URGENT',
    ordered_at: '2026-10-13T08:30:00Z',
  },
  {
    procedure_order_id: 'ord_002',
    provider_id: 'usr_002',
    patient_id: 'pat_002',
    mrn: 'MRN-5512-1002',
    modality: 'CXR',
    procedure_code: '71046',
    procedure_name: 'Chest Radiograph 2 Views PA/Lateral',
    clinical_indication: 'Pleuritic pain, rule out acute pneumothorax or consolidation.',
    order_priority: 'STAT',
    order_status: 'pending',
    dicom_accession_number: 'ACC-2026-0942',
    linked_job_id: 'MIP-9901-STAT',
    ordered_at: '2026-10-13T09:00:00Z',
  },
];

export default function OpenEMRHub() {
  // Theme state: 'light' (Classic OpenEMR Hospital Blue) or 'dark' (OpenEMR Dark Mode)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Active top-level OpenEMR View/Tab
  const [openemrView, setOpenemrView] = useState<
    'dashboard' | 'flowboard' | 'procedures' | 'encounters' | 'fhir' | 'mipaas_ai' | 'admin'
  >('dashboard');

  // Sub-tab within Patient Dashboard
  const [chartSubTab, setChartSubTab] = useState<'summary' | 'issues' | 'vitals' | 'documents' | 'billing'>('summary');

  // Data states
  const [patients, setPatients] = useState<ExtendedPatient[]>(DEFAULT_PATIENTS);
  const [activePatientId, setActivePatientId] = useState<string>('pat_001');
  const [orders, setOrders] = useState<OpenEMRProcedureOrder[]>(DEFAULT_ORDERS);
  const [encounters, setEncounters] = useState<OpenEMREncounter[]>([]);
  const [practitioners, setPractitioners] = useState<OpenEMRUser[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showNewEncounterModal, setShowNewEncounterModal] = useState(false);

  // Embedded AI Workstation state within OpenEMR
  const [aiViewMode, setAiViewMode] = useState<'original' | 'heatmap' | 'split'>('heatmap');
  const [aiReportSigned, setAiReportSigned] = useState(false);
  const [aiReportSignature, setAiReportSignature] = useState<string | null>(null);
  const [aiReportProse, setAiReportProse] = useState<string>(
    'TECHNIQUE: Low-Dose Chest CT Volume (Non-contrast).\n\nFINDINGS: Right apical solid pulmonary nodule measuring 8.4mm with spiculated borders. Demonstrates +48.2% volumetric expansion relative to prior study (VDT: 326 days).\n\nIMPRESSION: Solid Pulmonary Nodule, Lung-RADS 4A. Biopsy or short-interval PET-CT recommended.'
  );

  // Flow Board simulated patients
  const [flowBoardPatients, setFlowBoardPatients] = useState([
    {
      pid: 1001,
      pubpid: 'MRN-8842-1001',
      name: 'Rigby, Eleanor',
      appt_time: '08:30 AM',
      arrival_time: '08:15 AM',
      status: 'Imaging Suite (MiPAAS AI)',
      room: 'Exam Room 3',
      provider: 'Dr. Elena Vance',
      modality: 'CT Thorax',
      priority: 'URGENT',
      wait_min: 24,
    },
    {
      pid: 1002,
      pubpid: 'MRN-5512-1002',
      name: 'Doe, John',
      appt_time: '09:00 AM',
      arrival_time: '08:48 AM',
      status: 'STAT Radiologist Triage',
      room: 'ED Bay 4',
      provider: 'Dr. Marcus Chen',
      modality: 'CXR Mobile',
      priority: 'STAT',
      wait_min: 12,
    },
    {
      pid: 1003,
      pubpid: 'MRN-3199-1003',
      name: 'Davis, Robert',
      appt_time: '10:15 AM',
      arrival_time: '10:05 AM',
      status: 'Waiting Room',
      room: 'Reception A',
      provider: 'Dr. Elena Vance',
      modality: 'CXR Routine',
      priority: 'ROUTINE',
      wait_min: 10,
    },
  ]);

  // FHIR Explorer state
  const [fhirResource, setFhirResource] = useState<'Patient' | 'ServiceRequest' | 'DiagnosticReport'>('Patient');
  const [copiedFhir, setCopiedFhir] = useState(false);

  // New Patient Form
  const [newPatientForm, setNewPatientForm] = useState({
    fname: '',
    lname: '',
    dob: '1978-08-20',
    sex: 'Female' as 'Male' | 'Female' | 'Other',
    phone_home: '+1-555-0199',
    street: '124 Beacon Street',
    city: 'Boston',
    state: 'MA',
    postal_code: '02116',
    allergies: 'Penicillin, Latex',
    chronic_conditions: 'Asthma, Mild Hypertension',
    medications: 'Albuterol HFA, Hydrochlorothiazide 25mg',
    clinical_notes: 'Referred for annual imaging evaluation.',
  });

  // New Order Form
  const [newOrderForm, setNewOrderForm] = useState({
    modality: 'CT' as 'CT' | 'CXR' | 'MRI',
    procedure_code: '71271',
    procedure_name: 'Low-Dose CT Thorax Screening',
    clinical_indication: 'Evaluate solitary pulmonary nodule and lung parenchyma',
    order_priority: 'URGENT' as 'STAT' | 'URGENT' | 'ROUTINE',
  });

  // Seed / load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [patRes, ordRes, encRes, usrRes] = await Promise.all([
          openemrService.getPatients(),
          openemrService.getOrders(),
          openemrService.getEncounters(),
          openemrService.getUsers(),
        ]);

        if (patRes.patients && patRes.patients.length > 0) {
          const enriched: ExtendedPatient[] = patRes.patients.map((p) => ({
            ...p,
            primary_provider: 'Dr. Elena Vance, MD',
            insurance_provider: 'Blue Cross Blue Shield (PPO #BC-99120)',
            medications:
              p.id === 'pat_001'
                ? ['Albuterol Sulfate Inhaler 90mcg (2 puffs Q4H PRN)', 'Tiotropium Bromide 18mcg Capsule daily', 'Lisinopril 10mg PO Daily']
                : ['Amlodipine Besylate 5mg PO Daily', 'Atorvastatin 20mg PO QHS'],
            vitals: {
              bp: p.id === 'pat_001' ? '128/82 mmHg' : '136/88 mmHg',
              pulse: p.id === 'pat_001' ? 74 : 82,
              resp: p.id === 'pat_001' ? 16 : 18,
              temp_f: 98.6,
              spo2: p.id === 'pat_001' ? 96 : 98,
              weight_kg: p.id === 'pat_001' ? 68.2 : 84.5,
              height_cm: p.id === 'pat_001' ? 164 : 178,
              bmi: p.id === 'pat_001' ? 25.4 : 26.7,
              date: '2026-10-13 08:30 EDT',
            },
          }));
          setPatients(enriched);
        }
        if (ordRes.orders) setOrders(ordRes.orders);
        if (encRes.encounters) setEncounters(encRes.encounters);
        if (usrRes.users) setPractitioners(usrRes.users);
      } catch (err) {
        console.warn('Backend loading warning, setting pre-seeded OpenEMR dataset:', err);
      }
    };
    loadData();
  }, []);

  // Active selected patient
  const activePatient = (patients && patients.length > 0 ? (patients.find((p) => p.id === activePatientId) || patients[0]) : DEFAULT_PATIENTS[0]);

  // Helper calculate age
  const calculateAge = (dobString?: string) => {
    if (!dobString) return 64;
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  const handlePatientSelect = (patientId: string) => {
    setActivePatientId(patientId);
    setShowPatientDropdown(false);
    setNotification(`Switched active OpenEMR chart to patient #${patientId}`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreatePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPat: ExtendedPatient = {
      id: `pat_${Date.now().toString().slice(-4)}`,
      pid: Math.floor(1000 + Math.random() * 9000),
      pubpid: `MRN-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`,
      fname: newPatientForm.fname,
      lname: newPatientForm.lname,
      dob: newPatientForm.dob,
      sex: newPatientForm.sex,
      phone_home: newPatientForm.phone_home,
      street: newPatientForm.street,
      city: newPatientForm.city,
      state: newPatientForm.state,
      postal_code: newPatientForm.postal_code,
      status: 'Active',
      allergies: newPatientForm.allergies.split(',').map((s) => s.trim()).filter(Boolean),
      chronic_conditions: newPatientForm.chronic_conditions.split(',').map((s) => s.trim()).filter(Boolean),
      medications: newPatientForm.medications.split(',').map((s) => s.trim()).filter(Boolean),
      clinical_notes: newPatientForm.clinical_notes,
      primary_provider: 'Dr. Elena Vance, MD',
      vitals: {
        bp: '124/80 mmHg',
        pulse: 72,
        resp: 16,
        temp_f: 98.6,
        spo2: 98,
        weight_kg: 70.0,
        height_cm: 170,
        bmi: 24.2,
        date: new Date().toLocaleString(),
      },
    };

    setPatients([newPat, ...patients]);
    setActivePatientId(newPat.id);
    setShowNewPatientModal(false);
    setNotification(`Patient ${newPat.fname} ${newPat.lname} registered into OpenEMR patient_data.`);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newOrd: OpenEMRProcedureOrder = {
      procedure_order_id: `ord_${Date.now().toString().slice(-3)}`,
      provider_id: 'usr_001',
      patient_id: activePatient.id,
      mrn: activePatient.pubpid,
      modality: newOrderForm.modality,
      procedure_code: newOrderForm.procedure_code,
      procedure_name: newOrderForm.procedure_name,
      clinical_indication: newOrderForm.clinical_indication,
      order_priority: newOrderForm.order_priority,
      order_status: 'in_progress',
      dicom_accession_number: `ACC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      ordered_at: new Date().toISOString(),
    };
    setOrders([newOrd, ...orders]);
    setShowNewOrderModal(false);
    setNotification(`Procedure order ${newOrd.procedure_order_id} generated in OpenEMR.`);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSignAiReport = async () => {
    const sig = `OPENEMR-SIG-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    setAiReportSignature(sig);
    setAiReportSigned(true);
    setNotification(`Diagnostic report signed & filed to OpenEMR patient chart with hash: ${sig}`);
    setTimeout(() => setNotification(null), 5000);
  };

  // Theme-aware color variables
  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-[#0A121A] text-slate-100' : 'bg-[#F8FAFC] text-slate-900';
  const cardBg = isDark ? 'bg-[#0E1A26] border-slate-800' : 'bg-white border-slate-200/90 shadow-2xs';
  const cardHeaderBg = isDark ? 'bg-[#132334] border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-teal-950 font-bold';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`min-h-screen ${bgMain} font-sans flex flex-col transition-colors selection:bg-teal-600 selection:text-white`}>
      {/* ══════════════════════════════════════════════════════════════════
          1. TOP BRAND & GLOBAL OPENEMR NAVIGATION BAR
      ══════════════════════════════════════════════════════════════════ */}
      <header className="bg-[#0F766E] text-white border-b border-[#0D9488] sticky top-0 z-50 shadow-md">
        <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded bg-white text-teal-800 font-black flex items-center justify-center text-sm shadow">
                +
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-sm tracking-tight text-white leading-tight">
                  OpenEMR <span className="text-[#00DCCE] font-normal text-xs font-mono">v7.0.3 · MiPAAS Integrated</span>
                </span>
                <span className="text-[10px] text-slate-300">
                  Certified EHR &amp; Clinical Management System
                </span>
              </div>
            </Link>

            {/* Quick Patient Finder in Header */}
            <div className="relative ml-4 hidden md:block">
              <div className="flex items-center bg-[#102438] rounded border border-[#2B4B6E] px-2.5 py-1">
                <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
                <input
                  type="text"
                  placeholder="Find Patient (Name, ID, MRN)..."
                  value={patientSearch}
                  onFocus={() => setShowPatientDropdown(true)}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="bg-transparent border-none text-white text-xs placeholder-slate-400 focus:outline-none w-56 font-sans"
                />
              </div>

              {/* Patient Autocomplete Dropdown */}
              {showPatientDropdown && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-[#0E1A26] text-slate-900 dark:text-white rounded-lg shadow-2xl border border-slate-300 dark:border-slate-700 py-1 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    Master Patient Index ({patients.length})
                  </div>
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePatientSelect(p.id)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[#EBF2F8] dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer ${
                        p.id === activePatient.id ? 'bg-[#EBF2F8] dark:bg-slate-800 font-bold text-[#006699]' : ''
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{p.lname}, {p.fname}</div>
                        <div className="text-[11px] text-slate-500 font-mono">PID: #{p.pid} · {p.pubpid} · DOB: {p.dob}</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">
                        {p.sex}
                      </span>
                    </button>
                  ))}
                  <div className="p-2 border-t border-slate-200 dark:border-slate-800 text-center">
                    <button
                      type="button"
                      onClick={() => { setShowPatientDropdown(false); setShowNewPatientModal(true); }}
                      className="text-xs text-[#006699] dark:text-[#00DCCE] font-bold flex items-center justify-center gap-1 w-full hover:underline"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Register New Patient in OpenEMR</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Facility, Attending Physician, Theme Toggle & Status */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 bg-[#102438] px-2.5 py-1 rounded text-[11px] border border-[#2B4B6E]">
              <Building2 className="w-3.5 h-3.5 text-[#00DCCE]" />
              <span>Facility: <strong>Main Hospital Campus</strong></span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#102438] px-2.5 py-1 rounded text-[11px] border border-[#2B4B6E]">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
              <span>Attending: <strong>Dr. Elena Vance, MD</strong></span>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              title={isDark ? 'Switch to Classic OpenEMR Hospital Theme' : 'Switch to OpenEMR Dark Mode'}
              className="px-2 py-1 rounded bg-[#102438] hover:bg-[#152e47] border border-[#2B4B6E] text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-cyan-300" />}
              <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
            </button>

            <Link
              href="/doctor"
              className="px-3 py-1 rounded bg-[#008280] hover:bg-[#006B69] text-white font-bold text-xs transition-colors flex items-center gap-1"
            >
              <span>Workstation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* ── OpenEMR Top Mega Menu Bar ── */}
        <nav className="bg-[#0D9488] border-t border-[#14B8A6]/30 px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto text-xs font-semibold text-white">
          <button
            type="button"
            onClick={() => setOpenemrView('dashboard')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              openemrView === 'dashboard'
                ? 'bg-white text-teal-900 font-bold shadow-xs'
                : 'hover:bg-white/10 text-white/90 hover:text-white'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Patient/Client Chart</span>
          </button>

          <button
            type="button"
            onClick={() => setOpenemrView('flowboard')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              openemrView === 'flowboard'
                ? 'bg-white text-teal-900 font-bold shadow-xs'
                : 'hover:bg-white/10 text-white/90 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Flow Board ({flowBoardPatients.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setOpenemrView('procedures')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              openemrView === 'procedures'
                ? 'bg-white text-teal-900 font-bold shadow-xs'
                : 'hover:bg-white/10 text-white/90 hover:text-white'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Procedures &amp; Imaging ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setOpenemrView('encounters')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              openemrView === 'encounters'
                ? 'bg-white text-teal-900 font-bold shadow-xs'
                : 'hover:bg-white/10 text-white/90 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Encounters (SOAP)</span>
          </button>

          <button
            type="button"
            onClick={() => setOpenemrView('mipaas_ai')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer font-bold ${
              openemrView === 'mipaas_ai'
                ? 'bg-white text-teal-900 font-bold shadow-xs'
                : 'bg-teal-700/60 text-white hover:bg-teal-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>MiPAAS AI Diagnostic Suite</span>
          </button>

          <button
            type="button"
            onClick={() => setOpenemrView('fhir')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              openemrView === 'fhir'
                ? 'bg-white text-teal-900 font-bold shadow-xs'
                : 'hover:bg-white/10 text-white/90 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>FHIR R4 Gateway</span>
          </button>

          <button
            type="button"
            onClick={() => setOpenemrView('admin')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              openemrView === 'admin'
                ? 'bg-white text-teal-900 font-bold shadow-xs'
                : 'hover:bg-white/10 text-white/90 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Administration / ACL</span>
          </button>
        </nav>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="bg-[#00DCCE] text-black px-6 py-2 text-center text-xs font-bold font-mono tracking-wide transition-all shadow-md">
          ✓ {notification}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          2. THE ICONIC OPENEMR PATIENT DEMOGRAPHICS STRIP (BANNER)
      ══════════════════════════════════════════════════════════════════ */}
      {activePatient && (
        <section className={`border-b ${isDark ? 'bg-[#101D2C] border-slate-800' : 'bg-[#E3EDF6] border-[#BCD2E8]'} px-4 py-2.5 shadow-inner`}>
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left: Patient Silhouette & Identity */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1B3A5B] text-white font-bold text-sm flex items-center justify-center border-2 border-white shadow">
                {activePatient.fname.charAt(0)}{activePatient.lname.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-[#1B3A5B]'} tracking-tight`}>
                    {activePatient.lname}, {activePatient.fname}
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#1B3A5B] text-white">
                    PID #{activePatient.pid}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#006699] text-white">
                    {activePatient.pubpid}
                  </span>
                </div>
                <div className={`text-[11px] ${textMuted} font-mono mt-0.5 flex flex-wrap items-center gap-2`}>
                  <span>DOB: <strong>{activePatient.dob}</strong> (Age {calculateAge(activePatient.dob)})</span>
                  <span>•</span>
                  <span>Sex: <strong>{activePatient.sex}</strong></span>
                  <span>•</span>
                  <span>Phone: {activePatient.phone_home}</span>
                  <span>•</span>
                  <span>Primary Provider: {activePatient.primary_provider}</span>
                </div>
              </div>
            </div>

            {/* Center: OpenEMR Allergies Alert (Red Alert Box) */}
            {activePatient.allergies && activePatient.allergies.length > 0 && (
              <div className="bg-rose-500/15 border-2 border-rose-500 rounded px-3 py-1 flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs animate-pulse">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <div>
                  <span className="uppercase text-[10px] tracking-wider block font-extrabold text-rose-800 dark:text-rose-200">
                    ⚠️ ALLERGIES:
                  </span>
                  <span>{activePatient.allergies.join(', ')}</span>
                </div>
              </div>
            )}

            {/* Right: Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewEncounterModal(true)}
                className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 text-[#006699]" />
                <span>+ New Encounter</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNewOrderModal(true)}
                className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
                <span>+ Order Procedure</span>
              </button>

              <button
                type="button"
                onClick={() => setOpenemrView('mipaas_ai')}
                className="px-3 py-1.5 rounded bg-[#008280] hover:bg-[#006B69] text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Launch MiPAAS AI</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          3. MAIN CONTENT: OPENEMR CLINICAL PANELS
      ══════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* ───────────── TAB A: PATIENT DASHBOARD / CHART (SUMMARY) ───────────── */}
        {openemrView === 'dashboard' && (
          <div className="space-y-4">
            {/* Chart Secondary Sub-tabs */}
            <div className="flex items-center gap-1 border-b border-slate-300 dark:border-slate-700 pb-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartSubTab('summary')}
                className={`px-3 py-1.5 rounded-t cursor-pointer ${
                  chartSubTab === 'summary'
                    ? 'bg-[#1B3A5B] text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Clinical Summary (6-Widgets)
              </button>
              <button
                type="button"
                onClick={() => setChartSubTab('issues')}
                className={`px-3 py-1.5 rounded-t cursor-pointer ${
                  chartSubTab === 'issues'
                    ? 'bg-[#1B3A5B] text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Medical Issues &amp; Diagnoses
              </button>
              <button
                type="button"
                onClick={() => setChartSubTab('vitals')}
                className={`px-3 py-1.5 rounded-t cursor-pointer ${
                  chartSubTab === 'vitals'
                    ? 'bg-[#1B3A5B] text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Vital Signs Flowsheet
              </button>
              <button
                type="button"
                onClick={() => setChartSubTab('documents')}
                className={`px-3 py-1.5 rounded-t cursor-pointer ${
                  chartSubTab === 'documents'
                    ? 'bg-[#1B3A5B] text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Documents &amp; PACS Scans
              </button>
            </div>

            {/* 6-WIDGET OPENEMR CLASSIC DASHBOARD GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* WIDGET 1: DEMOGRAPHICS & CONTACT */}
              <div className={`rounded-lg border ${cardBg} overflow-hidden shadow-sm flex flex-col`}>
                <div className={`px-4 py-2 border-b font-bold text-xs flex items-center justify-between ${cardHeaderBg}`}>
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#006699]" />
                    Demographics &amp; Insurance
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewPatientModal(true)}
                    className="text-[11px] text-[#006699] dark:text-[#00DCCE] hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="p-4 space-y-2 text-xs flex-1">
                  <div>
                    <span className={`${textMuted} block text-[11px]`}>Residential Address:</span>
                    <span className="font-semibold">{activePatient.street}, {activePatient.city}, {activePatient.state} {activePatient.postal_code}</span>
                  </div>
                  <div>
                    <span className={`${textMuted} block text-[11px]`}>Primary Phone:</span>
                    <span className="font-semibold">{activePatient.phone_home}</span>
                  </div>
                  <div>
                    <span className={`${textMuted} block text-[11px]`}>Primary Health Insurance:</span>
                    <span className="font-semibold text-[#006699] dark:text-[#00DCCE]">{activePatient.insurance_provider}</span>
                  </div>
                  <div>
                    <span className={`${textMuted} block text-[11px]`}>Record Status:</span>
                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                      {activePatient.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* WIDGET 2: MEDICAL ISSUES (ICD-10) */}
              <div className={`rounded-lg border ${cardBg} overflow-hidden shadow-sm flex flex-col`}>
                <div className={`px-4 py-2 border-b font-bold text-xs flex items-center justify-between ${cardHeaderBg}`}>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Medical Issues (ICD-10)
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                    {activePatient.chronic_conditions?.length || 0} active
                  </span>
                </div>
                <div className="p-4 space-y-2 text-xs flex-1">
                  {activePatient.chronic_conditions?.map((cond, idx) => (
                    <div key={idx} className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start justify-between">
                      <div>
                        <div className="font-bold">{cond}</div>
                        <div className={`text-[10px] ${textMuted} font-mono`}>Onset: Documented in OpenEMR</div>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* WIDGET 3: ALLERGIES & ADVERSE REACTIONS */}
              <div className={`rounded-lg border ${cardBg} overflow-hidden shadow-sm flex flex-col`}>
                <div className={`px-4 py-2 border-b font-bold text-xs flex items-center justify-between ${cardHeaderBg}`}>
                  <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Allergies &amp; Intolerances
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded">
                    CRITICAL
                  </span>
                </div>
                <div className="p-4 space-y-2 text-xs flex-1">
                  {activePatient.allergies?.map((allergy, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                      <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        <span>{allergy}</span>
                      </div>
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                        Reaction: Severe Pruritus / Airway Restriction risk. Pre-medication required for contrast.
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* WIDGET 4: ACTIVE MEDICATIONS & PRESCRIPTIONS */}
              <div className={`rounded-lg border ${cardBg} overflow-hidden shadow-sm flex flex-col`}>
                <div className={`px-4 py-2 border-b font-bold text-xs flex items-center justify-between ${cardHeaderBg}`}>
                  <span className="flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-purple-500" />
                    Active Medications
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">e-Rx Synced</span>
                </div>
                <div className="p-4 space-y-2 text-xs flex-1">
                  {activePatient.medications?.map((med, idx) => (
                    <div key={idx} className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{med}</div>
                      <div className={`text-[10px] ${textMuted} font-mono mt-0.5`}>Prescribed by {activePatient.primary_provider}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* WIDGET 5: VITALS & PHYSICAL MEASUREMENTS */}
              <div className={`rounded-lg border ${cardBg} overflow-hidden shadow-sm flex flex-col`}>
                <div className={`px-4 py-2 border-b font-bold text-xs flex items-center justify-between ${cardHeaderBg}`}>
                  <span className="flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                    Vitals Flowsheet
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{activePatient.vitals?.date}</span>
                </div>
                <div className="p-4 text-xs flex-1 grid grid-cols-2 gap-3">
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className={`${textMuted} block text-[10px]`}>Blood Pressure</span>
                    <span className="font-extrabold text-sm text-[#006699] dark:text-[#00DCCE]">{activePatient.vitals?.bp}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className={`${textMuted} block text-[10px]`}>Pulse / Heart Rate</span>
                    <span className="font-extrabold text-sm">{activePatient.vitals?.pulse} bpm</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className={`${textMuted} block text-[10px]`}>SpO2 Pulse Ox</span>
                    <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">{activePatient.vitals?.spo2}%</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className={`${textMuted} block text-[10px]`}>Body Mass Index (BMI)</span>
                    <span className="font-extrabold text-sm">{activePatient.vitals?.bmi}</span>
                  </div>
                </div>
              </div>

              {/* WIDGET 6: CLINICAL NARRATIVE & ORDERS QUICK STATUS */}
              <div className={`rounded-lg border ${cardBg} overflow-hidden shadow-sm flex flex-col`}>
                <div className={`px-4 py-2 border-b font-bold text-xs flex items-center justify-between ${cardHeaderBg}`}>
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#006699]" />
                    Clinical Narrative &amp; Plan
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenemrView('procedures')}
                    className="text-[11px] text-[#006699] dark:text-[#00DCCE] hover:underline"
                  >
                    View All Orders
                  </button>
                </div>
                <div className="p-4 text-xs space-y-3 flex-1">
                  <p className="italic text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded border border-slate-200 dark:border-slate-700">
                    "{activePatient.clinical_notes}"
                  </p>
                  <div>
                    <span className="font-bold block text-[11px] mb-1">Open Diagnostic Orders:</span>
                    <div className="space-y-1.5">
                      {orders.filter((o) => o.patient_id === activePatient.id).map((o) => (
                        <div key={o.procedure_order_id} className="p-2 rounded bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-[#006699] dark:text-cyan-300">{o.modality} · {o.procedure_name}</span>
                            <div className="text-[10px] text-slate-500 font-mono">Order #{o.procedure_order_id} · Priority: {o.order_priority}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOpenemrView('mipaas_ai')}
                            className="px-2 py-1 rounded bg-[#008280] text-white font-bold text-[10px]"
                          >
                            Diagnose
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ───────────── TAB B: OPENEMR FLOW BOARD (CLINIC FLOOR) ───────────── */}
        {openemrView === 'flowboard' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#006699] dark:text-[#00DCCE]" />
                  <span>OpenEMR Clinic Flow Board</span>
                </h2>
                <p className={`${textMuted} text-xs mt-0.5`}>
                  Real-time clinic floor tracking, exam room allocation, and imaging procedure status.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-800">
                  Floor Occupancy: 3 / 8 Rooms Active
                </span>
              </div>
            </div>

            {/* Flow Board Table */}
            <div className={`rounded-lg border ${cardBg} overflow-hidden shadow-sm`}>
              <table className="w-full text-left text-xs">
                <thead className={`border-b ${cardHeaderBg} font-bold`}>
                  <tr>
                    <th className="p-3">PID / MRN</th>
                    <th className="p-3">Patient Name</th>
                    <th className="p-3">Appt Time</th>
                    <th className="p-3">Arrival</th>
                    <th className="p-3">Flow Status</th>
                    <th className="p-3">Exam Room</th>
                    <th className="p-3">Provider</th>
                    <th className="p-3">Modality / Priority</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                  {flowBoardPatients.map((pt, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        pt.pid === activePatient.pid ? 'bg-cyan-50/50 dark:bg-cyan-950/20 font-medium' : ''
                      }`}
                    >
                      <td className="p-3 font-mono font-bold text-[#006699] dark:text-[#00DCCE]">
                        #{pt.pid} ({pt.pubpid})
                      </td>
                      <td className="p-3 font-bold">{pt.name}</td>
                      <td className="p-3 font-mono text-slate-500">{pt.appt_time}</td>
                      <td className="p-3 font-mono text-slate-500">{pt.arrival_time}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          pt.status.includes('STAT')
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 animate-pulse'
                            : pt.status.includes('MiPAAS')
                            ? 'bg-[#008280]/20 text-[#008280] dark:text-[#00DCCE]'
                            : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        }`}>
                          {pt.status}
                        </span>
                      </td>
                      <td className="p-3 font-semibold">{pt.room}</td>
                      <td className="p-3">{pt.provider}</td>
                      <td className="p-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          pt.priority === 'STAT' ? 'bg-rose-500 text-white' : pt.priority === 'URGENT' ? 'bg-amber-500 text-black' : 'bg-emerald-600 text-white'
                        }`}>
                          {pt.modality} · {pt.priority}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const found = patients.find((p) => p.pid === pt.pid);
                            if (found) handlePatientSelect(found.id);
                            setOpenemrView('mipaas_ai');
                          }}
                          className="px-2.5 py-1 rounded bg-[#006699] hover:bg-[#005580] text-white font-bold text-[11px] cursor-pointer"
                        >
                          Triage in MiPAAS
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ───────────── TAB C: PROCEDURES & IMAGING ORDERS ───────────── */}
        {openemrView === 'procedures' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-[#006699] dark:text-[#00DCCE]" />
                  <span>OpenEMR Procedure &amp; Diagnostic Imaging Worklist (`procedure_order`)</span>
                </h2>
                <p className={`${textMuted} text-xs mt-0.5`}>
                  Electronic orders tied to CPT radiology billing codes, accession numbers, and MiPAAS inference.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowNewOrderModal(true)}
                className="px-3.5 py-2 rounded bg-[#006699] hover:bg-[#005580] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Electronic Order</span>
              </button>
            </div>

            <div className={`rounded-lg border ${cardBg} overflow-hidden shadow-sm`}>
              <table className="w-full text-left text-xs">
                <thead className={`border-b ${cardHeaderBg} font-bold`}>
                  <tr>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Patient / MRN</th>
                    <th className="p-3">Modality &amp; CPT</th>
                    <th className="p-3">Procedure Name</th>
                    <th className="p-3">Clinical Indication</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                  {orders.map((ord) => {
                    const patient = patients.find((p) => p.id === ord.patient_id);
                    return (
                      <tr key={ord.procedure_order_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono font-bold text-[#006699] dark:text-[#00DCCE]">
                          #{ord.procedure_order_id}
                        </td>
                        <td className="p-3">
                          <div className="font-bold">{patient ? `${patient.lname}, ${patient.fname}` : ord.mrn}</div>
                          <div className={`text-[10px] ${textMuted} font-mono`}>{ord.mrn}</div>
                        </td>
                        <td className="p-3 font-mono font-bold">
                          {ord.modality} · CPT {ord.procedure_code}
                        </td>
                        <td className="p-3 font-semibold">{ord.procedure_name}</td>
                        <td className="p-3 italic text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {ord.clinical_indication}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            ord.order_priority === 'STAT' ? 'bg-rose-500 text-white animate-pulse' : ord.order_priority === 'URGENT' ? 'bg-amber-500 text-black' : 'bg-emerald-600 text-white'
                          }`}>
                            {ord.order_priority}
                          </span>
                        </td>
                        <td className="p-3 font-mono uppercase text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          {ord.order_status}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (patient) setActivePatientId(patient.id);
                              setOpenemrView('mipaas_ai');
                            }}
                            className="px-2.5 py-1 rounded bg-[#008280] hover:bg-[#006B69] text-white font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Diagnose</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ───────────── TAB D: EMBEDDED MIPAAS AI DIAGNOSTIC SUITE ───────────── */}
        {openemrView === 'mipaas_ai' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A1823] text-white p-4 rounded-xl border border-white/10 shadow-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#00DCCE]/20 border border-[#00DCCE]/40 text-[#00DCCE] font-mono text-[11px] font-bold">
                    EMBEDDED IN OPENEMR
                  </span>
                  <h2 className="text-xl font-black text-white">MiPAAS Diagnostic Station · {activePatient.lname}, {activePatient.fname}</h2>
                </div>
                <p className="text-xs text-slate-300 mt-1 font-mono">
                  Order #ord_001 · Modality: CT Thorax Low-Dose Screening · Accession: ACC-2026-0941
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAiViewMode('original')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                    aiViewMode === 'original' ? 'bg-[#008280] text-white' : 'bg-white/10 text-gray-300'
                  }`}
                >
                  Raw DICOM
                </button>
                <button
                  type="button"
                  onClick={() => setAiViewMode('heatmap')}
                  className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
                    aiViewMode === 'heatmap' ? 'bg-[#00DCCE] text-black shadow-md' : 'bg-white/10 text-gray-300'
                  }`}
                >
                  Grad-CAM++ Overlay
                </button>
                <button
                  type="button"
                  onClick={() => setAiViewMode('split')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                    aiViewMode === 'split' ? 'bg-[#008280] text-white' : 'bg-white/10 text-gray-300'
                  }`}
                >
                  Split View
                </button>
              </div>
            </div>

            {/* Embedded Workstation Dual-Pane Canvas & Report */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Viewport (7 Cols) */}
              <div className="lg:col-span-7 bg-[#060B11] rounded-xl border border-white/10 p-4 flex flex-col items-center justify-center relative min-h-[420px] shadow-2xl">
                <div className="relative max-w-sm rounded-xl overflow-hidden border border-white/20 shadow-2xl">
                  {/* Synthetic Medical Radiograph */}
                  <div className="w-[340px] h-[340px] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black relative flex items-center justify-center">
                    <div className="w-40 h-52 rounded-full border border-neutral-700/50 absolute" />
                    <div className="w-24 h-32 rounded-full bg-neutral-800/60 absolute left-24 top-24" />

                    {/* Grad-CAM overlay */}
                    {aiViewMode !== 'original' && (
                      <div
                        className="absolute inset-0 bg-radial from-red-500/70 via-amber-500/40 to-transparent opacity-85 mix-blend-screen pointer-events-none"
                        style={{
                          backgroundPosition: '65% 25%',
                          backgroundSize: '150px 150px',
                          backgroundRepeat: 'no-repeat',
                        }}
                      />
                    )}

                    <span className="absolute top-3 right-3 text-xs font-mono font-bold text-white/50">
                      R · 1.0mm Thin
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 text-[10px] font-mono text-gray-400 bg-black/70 px-2 py-1 rounded">
                  {activePatient.pubpid} · Lung Window -600/1500 HU
                </div>
                <div className="absolute bottom-3 right-3 text-[10px] font-mono text-[#00DCCE] bg-black/70 px-2 py-1 rounded">
                  AI Model: ResNet3D_Lung_v1.8 (94.2% Conf)
                </div>
              </div>

              {/* Right Report Editor & e-Signature (5 Cols) */}
              <div className={`lg:col-span-5 rounded-xl border ${cardBg} p-4 flex flex-col space-y-3`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-xs uppercase text-[#006699] dark:text-[#00DCCE]">
                    OpenEMR Diagnostic Report Editor
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    ACR RadLex Form
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                    Radiologist Narrative Impression:
                  </label>
                  <textarea
                    rows={8}
                    value={aiReportProse}
                    onChange={(e) => setAiReportProse(e.target.value)}
                    className="w-full text-xs font-mono p-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-black/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#006699]"
                  />
                </div>

                <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 font-mono">
                  {aiReportSigned ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      CERTIFIED IN OPENEMR ({aiReportSignature})
                    </span>
                  ) : (
                    <span>⚠️ Unsigned. Signing automatically files this report into OpenEMR `procedure_report`.</span>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <Link
                    href="/doctor"
                    className="text-xs text-[#006699] dark:text-[#00DCCE] font-bold hover:underline"
                  >
                    Open in Full Workstation →
                  </Link>

                  <button
                    type="button"
                    onClick={handleSignAiReport}
                    className="px-4 py-2 rounded bg-[#008280] hover:bg-[#006B69] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{aiReportSigned ? 'Certified & Locked' : 'Sign & File into OpenEMR'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ───────────── TAB E: ENCOUNTERS & SOAP NOTES ───────────── */}
        {openemrView === 'encounters' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#006699] dark:text-[#00DCCE]" />
                  <span>Clinical Encounters &amp; SOAP Documentation (`form_encounter`)</span>
                </h2>
                <p className={`${textMuted} text-xs mt-0.5`}>
                  Historical consultation visits, chief complaints, and structured clinical notes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowNewEncounterModal(true)}
                className="px-3.5 py-2 rounded bg-[#006699] hover:bg-[#005580] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Clinical Encounter</span>
              </button>
            </div>

            <div className="space-y-3">
              {encounters.map((enc) => (
                <div key={enc.id} className={`p-4 rounded-lg border ${cardBg} shadow-sm space-y-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#006699] dark:text-[#00DCCE]">
                        Encounter #{enc.encounter}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 uppercase">
                        {enc.status}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">Date: {enc.date}</span>
                    </div>
                    <span className="text-xs text-slate-500">Attending Provider: Dr. Elena Vance</span>
                  </div>

                  <div className="text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Chief Complaint / Reason for Visit:</span>
                    <p className="mt-0.5 text-slate-800 dark:text-slate-200">{enc.reason}</p>
                  </div>

                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs font-mono space-y-1">
                    <div><strong>S (Subjective):</strong> Patient reports mild exertional dyspnea, denies hemoptysis or fevers.</div>
                    <div><strong>O (Objective):</strong> Auscultation reveals faint bilateral expiratory wheezing. SpO2 96% on room air.</div>
                    <div><strong>A (Assessment):</strong> High-risk smoker with indeterminate apical nodule. Stable COPD.</div>
                    <div><strong>P (Plan):</strong> Low-Dose CT screening protocol ordered. Return in 12 months for volumetric follow-up.</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ───────────── TAB F: HL7 FHIR R4 API GATEWAY ───────────── */}
        {openemrView === 'fhir' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <span>HL7 FHIR R4 Interoperability &amp; ONC Cures Act Gateway</span>
                </h2>
                <p className={`${textMuted} text-xs mt-0.5`}>
                  Standardized JSON payloads for OpenEMR clinical resources.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(activePatient, null, 2));
                    setCopiedFhir(true);
                    setTimeout(() => setCopiedFhir(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedFhir ? 'Copied!' : 'Copy FHIR JSON'}</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#0E1A26] border border-slate-700 font-mono text-xs text-cyan-300 overflow-x-auto max-h-[500px]">
              <pre>
{JSON.stringify(
  {
    resourceType: 'Patient',
    id: activePatient.id,
    meta: {
      versionId: '1',
      lastUpdated: new Date().toISOString(),
      source: 'OpenEMR-MiPAAS-Certified-EHR',
    },
    identifier: [
      {
        use: 'official',
        system: 'urn:oid:2.16.840.1.113883.4.6',
        value: activePatient.pubpid,
      },
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: activePatient.lname,
        given: [activePatient.fname],
      },
    ],
    telecom: [{ system: 'phone', value: activePatient.phone_home, use: 'home' }],
    gender: activePatient.sex.toLowerCase(),
    birthDate: activePatient.dob,
    address: [
      {
        use: 'home',
        line: [activePatient.street],
        city: activePatient.city,
        state: activePatient.state,
        postalCode: activePatient.postal_code,
        country: 'USA',
      },
    ],
  },
  null,
  2
)}
              </pre>
            </div>
          </div>
        )}

        {/* ───────────── TAB G: ADMINISTRATION & ACL ───────────── */}
        {openemrView === 'admin' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>OpenEMR Administration &amp; Access Control Lists (ACL)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${cardBg} space-y-2`}>
                <h3 className="font-bold text-sm">Practitioners &amp; NPI Directory</h3>
                <div className="space-y-2 text-xs">
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="font-bold">Dr. Elena Vance, MD</div>
                    <div className="text-[11px] text-slate-500 font-mono">NPI: 1942850123 · Specialty: Thoracic Radiology · Authorized: Yes</div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="font-bold">Dr. Marcus Chen, MD</div>
                    <div className="text-[11px] text-slate-500 font-mono">NPI: 1839201948 · Specialty: Emergency Medicine · Authorized: Yes</div>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${cardBg} space-y-2`}>
                <h3 className="font-bold text-sm">System Compliance &amp; Cures Act</h3>
                <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>ONC 2015 Edition Cures Act Certified API (g)(10) Active</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>HIPAA Security Rule Audit Logging: Level 4 Active</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>USCDI v3 Data Elements Validated</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════════
          4. MODAL: REGISTER NEW OPENEMR PATIENT
      ══════════════════════════════════════════════════════════════════ */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full rounded-xl bg-white dark:bg-[#0E1A26] border border-slate-300 dark:border-slate-700 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#006699]" />
                <span>OpenEMR New Patient Demographics Registration</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewPatientModal(false)}
                className="text-slate-400 hover:text-black dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePatientSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newPatientForm.fname}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, fname: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none focus:border-[#006699]"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newPatientForm.lname}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, lname: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none focus:border-[#006699]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={newPatientForm.dob}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, dob: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none focus:border-[#006699]"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Biological Sex *</label>
                  <select
                    value={newPatientForm.sex}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, sex: e.target.value as 'Male' | 'Female' | 'Other' })}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none focus:border-[#006699]"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1 text-rose-600 dark:text-rose-400">Known Allergies (Comma separated)</label>
                <input
                  type="text"
                  value={newPatientForm.allergies}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, allergies: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Medical Conditions (Comma separated)</label>
                <input
                  type="text"
                  value={newPatientForm.chronic_conditions}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, chronic_conditions: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none focus:border-[#006699]"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Clinical Referral Notes</label>
                <textarea
                  rows={2}
                  value={newPatientForm.clinical_notes}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, clinical_notes: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none focus:border-[#006699]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="px-4 py-2 rounded bg-slate-200 dark:bg-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#006699] hover:bg-[#005580] text-white font-bold cursor-pointer"
                >
                  Save to OpenEMR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          5. MODAL: CREATE PROCEDURE ORDER
      ══════════════════════════════════════════════════════════════════ */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl bg-white dark:bg-[#0E1A26] border border-slate-300 dark:border-slate-700 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#006699]" />
                <span>Place Electronic Procedure Order</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="text-slate-400 hover:text-black dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-3 text-xs">
              <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">
                Patient: <strong>{activePatient.lname}, {activePatient.fname}</strong> ({activePatient.pubpid})
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Imaging Modality *</label>
                  <select
                    value={newOrderForm.modality}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, modality: e.target.value as 'CT' | 'CXR' | 'MRI' })}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none"
                  >
                    <option value="CT">CT Volume (Thorax/Head)</option>
                    <option value="CXR">CXR Radiograph</option>
                    <option value="MRI">MRI Multi-Sequence</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold block mb-1">Priority Gate *</label>
                  <select
                    value={newOrderForm.order_priority}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, order_priority: e.target.value as 'STAT' | 'URGENT' | 'ROUTINE' })}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none"
                  >
                    <option value="ROUTINE">ROUTINE</option>
                    <option value="URGENT">URGENT (60m)</option>
                    <option value="STAT">STAT (15m Critical)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Procedure Name &amp; CPT Code *</label>
                <input
                  type="text"
                  required
                  value={newOrderForm.procedure_name}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, procedure_name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Clinical Indication *</label>
                <textarea
                  rows={2}
                  required
                  value={newOrderForm.clinical_indication}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, clinical_indication: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 rounded bg-slate-200 dark:bg-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#006699] hover:bg-[#005580] text-white font-bold cursor-pointer"
                >
                  Authorize Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          6. MODAL: CREATE NEW ENCOUNTER
      ══════════════════════════════════════════════════════════════════ */}
      {showNewEncounterModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl bg-white dark:bg-[#0E1A26] border border-slate-300 dark:border-slate-700 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#006699]" />
                <span>Open Clinical Encounter (`form_encounter`)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewEncounterModal(false)}
                className="text-slate-400 hover:text-black dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">
                Patient: <strong>{activePatient.lname}, {activePatient.fname}</strong> (#{activePatient.pid})
              </div>

              <div>
                <label className="font-bold block mb-1">Chief Complaint / Reason for Consultation *</label>
                <textarea
                  rows={3}
                  defaultValue="Follow-up diagnostic radiograph review for pulmonary nodule surveillance."
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Attending Clinician</label>
                <input
                  type="text"
                  readOnly
                  value="Dr. Elena Vance, MD (Thoracic Radiology)"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-mono text-slate-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowNewEncounterModal(false)}
                  className="px-4 py-2 rounded bg-slate-200 dark:bg-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewEncounterModal(false);
                    setNotification('New clinical encounter registered in OpenEMR.');
                    setTimeout(() => setNotification(null), 3000);
                  }}
                  className="px-4 py-2 rounded bg-[#006699] hover:bg-[#005580] text-white font-bold cursor-pointer"
                >
                  Start Encounter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
