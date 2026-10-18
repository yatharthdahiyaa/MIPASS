'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  QrCode,
  Download,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Lock,
  Heart,
  Activity,
  FileText,
  User,
  Phone,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  Zap,
  Info,
  Shield,
  Check,
  X,
  Radio,
  FileCheck2,
  ArrowRight,
  Award,
  BadgeCheck,
  RotateCw,
} from 'lucide-react';

// Types
export interface AbhaProfile {
  id: string;
  userId: string;
  abhaNumber: string;
  abhaAddress: string;
  fullName: string;
  gender: string;
  dob: string;
  age: number;
  bloodGroup: string;
  mobile: string;
  email: string;
  state: string;
  district: string;
  pincode: string;
  address: string;
  kycStatus: string;
  kycMethod: string;
  verificationDate: string;
  nottoPledgeId?: string;
  organDonorStatus?: string;
  photoUri?: string;
  issuer: string;
  scheme: string;
}

export interface AarogyaSetuAssessment {
  id: string;
  riskLevel: 'SAFE_LOW' | 'MODERATE' | 'HIGH';
  riskText: string;
  riskSubtext: string;
  score: number;
  symptoms: string[];
  comorbidities: string[];
  travelHistory: boolean;
  contactExposure: boolean;
  bluetoothContactStatus: string;
  proximityDeviceCount: number;
  recommendations: string[];
  assessedAt: string;
}

export interface AbdmConsent {
  id: string;
  consentRequestId: string;
  requesterName: string;
  department: string;
  requesterType: string;
  purposeCode: string;
  purposeDescription: string;
  recordTypes: string[];
  dateRangeFrom: string;
  dateRangeTo: string;
  expiryDate: string;
  status: 'REQUESTED' | 'GRANTED' | 'DENIED' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
  hiuId: string;
}

export interface LinkedFacility {
  id: string;
  hipId: string;
  facilityName: string;
  facilityType: string;
  state: string;
  linkedDate: string;
  syncStatus: string;
  recordsCount: number;
  lastSyncedAt: string;
}

export interface ScanToken {
  id: string;
  tokenNumber: string;
  facilityName: string;
  department: string;
  counterNumber: string;
  queuePosition: number;
  estimatedWaitMins: number;
  status: string;
  generatedAt: string;
  abhaNumber: string;
  abhaAddress: string;
}

export interface VaccinationDose {
  id: string;
  vaccineName: string;
  doseType: string;
  dateAdministered: string;
  batchNumber: string;
  manufacturer: string;
  vaccinatedBy: string;
  centerName: string;
  certificateRef: string;
  status: string;
}

export interface EmergencyPass {
  fullName: string;
  bloodGroup: string;
  dob: string;
  abhaId: string;
  primaryContact: { name: string; phone: string; relation: string };
  secondaryContact: { name: string; phone: string; relation: string };
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  organDonor: { isDonor: boolean; pledgeId: string; pledgedOrgans: string; registry: string };
  emergencyInstructions: string;
}

export default function AbhaAarogyaSetuHub() {
  const [activeTab, setActiveTab] = useState<
    'shield' | 'card' | 'scan_share' | 'consents' | 'facilities' | 'vaccine' | 'emergency'
  >('shield');

  // State
  const [profile, setProfile] = useState<AbhaProfile>({
    id: 'abha_prof_01',
    userId: 'default-user',
    abhaNumber: '91-4567-8901-2345',
    abhaAddress: 'rahul.sharma@abdm',
    fullName: 'Rahul Sharma',
    gender: 'Male',
    dob: '1988-08-15',
    age: 36,
    bloodGroup: 'O+',
    mobile: '+91 98765 43210',
    email: 'rahul.sharma@mipaas.health',
    state: 'Delhi',
    district: 'New Delhi',
    pincode: '110029',
    address: 'B-42, Safdarjung Enclave, New Delhi - 110029',
    kycStatus: 'UIDAI_VERIFIED',
    kycMethod: 'Aadhaar e-KYC (Biometric & OTP)',
    verificationDate: '2024-01-12',
    nottoPledgeId: 'NOTTO-DL-2024-88419',
    organDonorStatus: 'Pledged Donor (Kidneys, Corneas, Heart)',
    photoUri: '/avatars/rahul_sharma.jpg',
    issuer: 'National Health Authority (NHA)',
    scheme: 'Ayushman Bharat Digital Mission (ABDM)',
  });

  const [assessment, setAssessment] = useState<AarogyaSetuAssessment>({
    id: 'as_eval_01',
    riskLevel: 'SAFE_LOW',
    riskText: 'You are Safe',
    riskSubtext: 'Low risk of infection based on current clinical symptoms and exposure log.',
    score: 0,
    symptoms: ['None of the above'],
    comorbidities: ['None of the above'],
    travelHistory: false,
    contactExposure: false,
    bluetoothContactStatus: 'No contact with confirmed COVID-19/infectious patient in last 14 days',
    proximityDeviceCount: 19,
    recommendations: [
      'Maintain hand hygiene by washing hands regularly with soap or sanitizer.',
      'Wear a surgical mask in crowded indoor health facilities or hospitals.',
      'Ensure your routine health vitals and booster vaccinations are up-to-date.',
    ],
    assessedAt: 'Today, 11:20 AM',
  });

  const [consents, setConsents] = useState<AbdmConsent[]>([
    {
      id: 'cns_01',
      consentRequestId: 'CR-AIIMS-2024-9912',
      requesterName: 'All India Institute of Medical Sciences (AIIMS), New Delhi',
      department: 'Cardiology & Radiology',
      requesterType: 'Autonomous National Institute',
      purposeCode: 'CARETREAT',
      purposeDescription: 'Review prior diagnostic imaging and ECG for upcoming teleconsultation',
      recordTypes: ['DiagnosticReport', 'Prescription', 'DischargeSummary'],
      dateRangeFrom: '2023-01-01',
      dateRangeTo: '2024-12-31',
      expiryDate: '2024-12-31T23:59:59Z',
      status: 'GRANTED',
      createdAt: '2024-10-10T10:15:00Z',
      hiuId: 'HIU-AIIMS-DELHI',
    },
    {
      id: 'cns_02',
      consentRequestId: 'CR-MAX-2024-4481',
      requesterName: 'Max Super Speciality Hospital, Saket',
      department: 'Internal Medicine',
      requesterType: 'Tertiary Care Hospital',
      purposeCode: 'DIAGNOSTIC',
      purposeDescription: 'Access recent blood work and diabetic profile for health screening',
      recordTypes: ['DiagnosticReport', 'OPConsultation'],
      dateRangeFrom: '2024-06-01',
      dateRangeTo: '2024-10-15',
      expiryDate: '2024-11-15T23:59:59Z',
      status: 'REQUESTED',
      createdAt: '2024-10-14T08:30:00Z',
      hiuId: 'HIU-MAX-SAKET',
    },
    {
      id: 'cns_03',
      consentRequestId: 'CR-FORTIS-2024-1102',
      requesterName: 'Fortis Escorts Heart Institute, Okhla',
      department: 'Emergency & Interventional Cardiology',
      requesterType: 'Hospital Network',
      purposeCode: 'EMERGENCY',
      purposeDescription: 'Emergency health records access during acute chest pain evaluation',
      recordTypes: ['DiagnosticReport', 'Prescription'],
      dateRangeFrom: '2024-01-01',
      dateRangeTo: '2024-10-10',
      expiryDate: '2024-10-11T00:00:00Z',
      status: 'EXPIRED',
      createdAt: '2024-10-09T14:20:00Z',
      hiuId: 'HIU-FORTIS-OKHLA',
    },
  ]);

  const [facilities, setFacilities] = useState<LinkedFacility[]>([
    {
      id: 'fac_01',
      hipId: 'IN0710000001',
      facilityName: 'All India Institute of Medical Sciences (AIIMS), New Delhi',
      facilityType: 'Central Government Apex Hospital',
      state: 'Delhi',
      linkedDate: '2023-11-14',
      syncStatus: 'SYNCED',
      recordsCount: 8,
      lastSyncedAt: 'Today, 09:42 AM',
    },
    {
      id: 'fac_02',
      hipId: 'IN0710000045',
      facilityName: 'Safdarjung Hospital & VMMC, New Delhi',
      facilityType: 'Government Medical College & Hospital',
      state: 'Delhi',
      linkedDate: '2024-02-20',
      syncStatus: 'SYNCED',
      recordsCount: 4,
      lastSyncedAt: 'Yesterday, 04:15 PM',
    },
    {
      id: 'fac_03',
      hipId: 'IN2710000109',
      facilityName: 'Tata Memorial Centre, Mumbai',
      facilityType: 'Cancer Speciality Center',
      state: 'Maharashtra',
      linkedDate: '2024-05-18',
      syncStatus: 'SYNCED',
      recordsCount: 2,
      lastSyncedAt: 'Oct 10, 2024',
    },
    {
      id: 'fac_04',
      hipId: 'IN0710000882',
      facilityName: 'Memorial Diagnostic Pavilion (MiPAAS OpenEMR Node)',
      facilityType: 'Diagnostic Radiology & AI Imaging Center',
      state: 'Delhi',
      linkedDate: '2024-01-05',
      syncStatus: 'LIVE',
      recordsCount: 14,
      lastSyncedAt: 'Live FHIR R4 Stream',
    },
  ]);

  const [scanTokens, setScanTokens] = useState<ScanToken[]>([
    {
      id: 'tok_01',
      tokenNumber: 'OPD-A-042',
      facilityName: 'All India Institute of Medical Sciences (AIIMS), New Delhi',
      department: 'Department of Cardiology & Chest Medicine',
      counterNumber: 'OPD Registration Counter 4',
      queuePosition: 3,
      estimatedWaitMins: 12,
      status: 'ACTIVE',
      generatedAt: 'Today, 08:45 AM',
      abhaNumber: '91-4567-8901-2345',
      abhaAddress: 'rahul.sharma@abdm',
    },
  ]);

  const [vaccinations] = useState<VaccinationDose[]>([
    {
      id: 'vac_01',
      vaccineName: 'COVISHIELD™ (ChAdOx1-S recombinant)',
      doseType: 'Dose 1',
      dateAdministered: '2021-04-18',
      batchNumber: '4120Z012',
      manufacturer: 'Serum Institute of India Pvt. Ltd.',
      vaccinatedBy: 'Sister Sunita Devi (ANM)',
      centerName: 'Safdarjung Hospital CVC Site 2, New Delhi',
      certificateRef: 'COWIN-DL-99482104-D1',
      status: 'Verified on CoWIN & ABDM',
    },
    {
      id: 'vac_02',
      vaccineName: 'COVISHIELD™ (ChAdOx1-S recombinant)',
      doseType: 'Dose 2',
      dateAdministered: '2021-07-22',
      batchNumber: '4121A044',
      manufacturer: 'Serum Institute of India Pvt. Ltd.',
      vaccinatedBy: 'Sister Rekha Sharma (ANM)',
      centerName: 'AIIMS New Delhi CVC Site 1, New Delhi',
      certificateRef: 'COWIN-DL-99482104-D2',
      status: 'Verified on CoWIN & ABDM',
    },
    {
      id: 'vac_03',
      vaccineName: 'CORBEVAX™ (Recombinant Protein Subunit)',
      doseType: 'Precaution Dose (Booster)',
      dateAdministered: '2022-09-10',
      batchNumber: 'CRB-8921B',
      manufacturer: 'Biological E. Limited',
      vaccinatedBy: 'Staff Nurse Priya Nair',
      centerName: 'Max Super Speciality CVC Saket, New Delhi',
      certificateRef: 'COWIN-DL-99482104-PREC',
      status: 'Verified on CoWIN & ABDM',
    },
  ]);

  const [emergencyPass] = useState<EmergencyPass>({
    fullName: 'Rahul Sharma',
    bloodGroup: 'O Positive (O+)',
    dob: '1988-08-15 (36 Years)',
    abhaId: '91-4567-8901-2345',
    primaryContact: {
      name: 'Priya Sharma (Spouse)',
      phone: '+91 98765 43210',
      relation: 'Spouse',
    },
    secondaryContact: {
      name: 'Dr. A. K. Sen (Consultant Physician)',
      phone: '+91 98111 22334',
      relation: 'Family Doctor',
    },
    allergies: ['Penicillin', 'Sulfa Drugs', 'NSAIDs (Aspirin)'],
    chronicConditions: ['Mild Essential Hypertension', 'Borderline Hyperlipidemia'],
    currentMedications: ['Lisinopril 10mg OD', 'Rosuvastatin 10mg OD'],
    organDonor: {
      isDonor: true,
      pledgeId: 'NOTTO-DL-2024-88419',
      pledgedOrgans: 'Corneas, Kidneys, Heart Valves, Liver',
      registry: 'National Organ & Tissue Transplant Organisation (NOTTO)',
    },
    emergencyInstructions:
      'In case of trauma or unresponsiveness, notify spouse immediately and transport to AIIMS New Delhi or nearest cardiac triage.',
  });

  // UI Interactive Modals & States
  const [cardFlipped, setCardFlipped] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentStep, setAssessmentStep] = useState(1);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedComorbidities, setSelectedComorbidities] = useState<string[]>([]);
  const [travelHistory, setTravelHistory] = useState(false);
  const [contactExposure, setContactExposure] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scan & Share State
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState('All India Institute of Medical Sciences (AIIMS), New Delhi');
  const [selectedDept, setSelectedDept] = useState('Outpatient Department (OPD)');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle Assessment Submission
  const handleCompleteAssessment = () => {
    let score = 0;
    const s = selectedSymptoms.filter((x) => x !== 'None of the above');
    const c = selectedComorbidities.filter((x) => x !== 'None of the above');
    score += s.length * 15;
    score += c.length * 10;
    if (travelHistory) score += 20;
    if (contactExposure) score += 35;

    let level: 'SAFE_LOW' | 'MODERATE' | 'HIGH' = 'SAFE_LOW';
    let text = 'You are Safe';
    let subtext = 'Low risk of infection based on current clinical symptoms and exposure log.';
    let recs = [
      'Maintain hand hygiene by washing hands regularly with soap or sanitizer.',
      'Wear a surgical mask in crowded indoor health facilities or hospitals.',
      'Ensure your routine health vitals and booster vaccinations are up-to-date.',
    ];

    if (score > 35) {
      level = 'HIGH';
      text = 'High Risk — Immediate Action Required';
      subtext = 'Multiple critical symptoms and exposure indicators detected.';
      recs = [
        'Immediately contact the National Health Helpline at toll-free 1075.',
        'Isolate immediately from family members and vulnerable elderly.',
        'Schedule an urgent clinical evaluation or visit the nearest COVID/Flu clinic.',
      ];
    } else if (score > 0) {
      level = 'MODERATE';
      text = 'Moderate Risk — Monitor Symptoms';
      subtext = 'Mild symptoms or risk factors observed. Self-quarantine and monitor closely.';
      recs = [
        'Stay at home in a well-ventilated room and limit physical contact.',
        'Take a rapid test if symptoms persist beyond 48 hours.',
        'Log your temperature and oxygen saturation twice daily.',
      ];
    }

    const newEval: AarogyaSetuAssessment = {
      id: `as_eval_${Date.now()}`,
      riskLevel: level,
      riskText: text,
      riskSubtext: subtext,
      score,
      symptoms: s.length > 0 ? s : ['None of the above'],
      comorbidities: c.length > 0 ? c : ['None of the above'],
      travelHistory,
      contactExposure,
      bluetoothContactStatus: contactExposure
        ? 'Potential exposure detected within 6 feet'
        : 'No contact with confirmed COVID-19/infectious patient in last 14 days',
      proximityDeviceCount: 22,
      recommendations: recs,
      assessedAt: 'Just now',
    };

    setAssessment(newEval);
    setShowAssessmentModal(false);
    showToast('Aarogya Setu self-assessment completed successfully.');
  };

  // Handle Consent Actions
  const handleConsentAction = (consentId: string, action: 'grant' | 'deny' | 'revoke') => {
    setConsents((prev) =>
      prev.map((c) => {
        if (c.id === consentId) {
          return {
            ...c,
            status: action === 'grant' ? 'GRANTED' : action === 'deny' ? 'DENIED' : 'REVOKED',
          };
        }
        return c;
      })
    );
    showToast(`Consent request has been ${action === 'grant' ? 'Approved' : action === 'deny' ? 'Denied' : 'Revoked'}.`);
  };

  // Handle Scan & Share
  const handleGenerateToken = () => {
    const seq = Math.floor(Math.random() * 60) + 40;
    const newToken: ScanToken = {
      id: `tok_${Date.now()}`,
      tokenNumber: `OPD-${selectedHospital.includes('AIIMS') ? 'AIIMS' : 'HOSP'}-${seq}`,
      facilityName: selectedHospital,
      department: selectedDept,
      counterNumber: `Counter ${Math.floor(Math.random() * 5) + 1}`,
      queuePosition: Math.floor(Math.random() * 4) + 2,
      estimatedWaitMins: Math.floor(Math.random() * 15) + 10,
      status: 'ACTIVE',
      generatedAt: 'Just now',
      abhaNumber: profile.abhaNumber,
      abhaAddress: profile.abhaAddress,
    };
    setScanTokens([newToken, ...scanTokens]);
    setShowScanModal(false);
    showToast(`Paperless token ${newToken.tokenNumber} generated! Proceed to ${newToken.counterNumber}.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 text-white shadow-2xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Government of India Official Top Bar */}
      <div className="rounded-3xl border border-white/10 shadow-2xl overflow-hidden" style={{ background: '#091522' }}>
        {/* Tricolor Ribbon */}
        <div className="h-1.5 w-full flex">
          <div className="w-1/3 bg-[#FF9933]" />
          <div className="w-1/3 bg-[#FFFFFF]" />
          <div className="w-1/3 bg-[#138808]" />
        </div>

        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-white/5">
          <div className="flex items-center gap-4">
            {/* National Emblem / Ashoka Chakra Motif */}
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-teal-500/20 border border-amber-500/30 text-amber-400 shadow-inner flex-shrink-0">
              <span className="text-2xl font-black">🇮🇳</span>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold tracking-widest uppercase text-amber-400">भारत सरकार</span>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] font-bold tracking-widest uppercase text-slate-300">
                  Government of India
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  NHA · ABDM 2.0
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                Ayushman Bharat &amp; Aarogya Setu Portal
              </h1>
              <p className="text-xs text-slate-400">
                Official Citizen Digital Health Account &middot; National Health Authority &middot; MoHFW
              </p>
            </div>
          </div>

          {/* Quick ABHA Chip */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <BadgeCheck className="w-3.5 h-3.5" />
                <span>UIDAI KYC Verified</span>
              </div>
              <div className="font-mono text-sm font-extrabold text-white tracking-wider">{profile.abhaNumber}</div>
              <div className="text-[11px] text-cyan-300 font-mono">{profile.abhaAddress}</div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('card')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>View ABHA Card</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Bar */}
        <div className="flex items-center gap-1 p-2 sm:px-4 bg-black/30 overflow-x-auto text-xs font-semibold scrollbar-none">
          {[
            { id: 'shield', label: 'Aarogya Setu Shield', icon: ShieldCheck, color: '#10B981' },
            { id: 'card', label: 'Official ABHA Card', icon: QrCode, color: '#00DCCE' },
            { id: 'scan_share', label: 'Scan & Share (OPD)', icon: Zap, color: '#F5A623', badge: 'Fast OPD' },
            { id: 'consents', label: 'Consent Manager (M3)', icon: Lock, color: '#7C5CFC', badge: '1 Pending' },
            { id: 'facilities', label: 'Linked Hospitals (HIP)', icon: Building2, color: '#38BDF8' },
            { id: 'vaccine', label: 'CoWIN Vaccination Pass', icon: Award, color: '#FF5A78' },
            { id: 'emergency', label: 'Emergency SOS Pass', icon: Heart, color: '#EF4444' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white/12 text-white shadow-lg border border-white/15'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" style={{ color: isActive ? tab.color : undefined }} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                    style={{ background: `${tab.color}25`, color: tab.color }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: AAROGYA SETU SHIELD & SELF-ASSESSMENT
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'shield' && (
        <div className="space-y-6">
          {/* Main Risk Shield Hero Banner */}
          <div
            className="rounded-3xl border border-white/10 p-6 sm:p-8 relative overflow-hidden shadow-2xl"
            style={{
              background:
                assessment.riskLevel === 'SAFE_LOW'
                  ? 'linear-gradient(135deg, #052317 0%, #0A3A26 50%, #071E14 100%)'
                  : assessment.riskLevel === 'MODERATE'
                  ? 'linear-gradient(135deg, #2D1A04 0%, #452608 50%, #201303 100%)'
                  : 'linear-gradient(135deg, #2D0808 0%, #4D1212 50%, #1F0505 100%)',
            }}
          >
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div
                  className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black shadow-2xl flex-shrink-0 ${
                    assessment.riskLevel === 'SAFE_LOW'
                      ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-500/40'
                      : assessment.riskLevel === 'MODERATE'
                      ? 'bg-amber-500/20 text-amber-300 border-2 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-2 border-rose-500/40'
                  }`}
                >
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-300">
                      Live Protection Radar
                    </span>
                    <span className="text-xs text-slate-400">&middot; {assessment.assessedAt}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">{assessment.riskText}</h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-xl mt-1 leading-relaxed">
                    {assessment.riskSubtext}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAssessmentStep(1);
                    setSelectedSymptoms([]);
                    setSelectedComorbidities([]);
                    setTravelHistory(false);
                    setContactExposure(false);
                    setShowAssessmentModal(true);
                  }}
                  className="px-5 py-3 rounded-2xl bg-white text-slate-900 font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-slate-100 transition-all shadow-xl cursor-pointer"
                >
                  <RotateCw className="w-4 h-4 text-emerald-600" />
                  <span>Retake Self-Assessment</span>
                </button>
              </div>
            </div>

            {/* Radar Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10 text-xs">
              <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                <span className="text-slate-400 block mb-1">Bluetooth Proximity Exposure</span>
                <strong className="text-emerald-300 font-bold block">{assessment.bluetoothContactStatus}</strong>
              </div>
              <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                <span className="text-slate-400 block mb-1">Active Devices in Proximity</span>
                <strong className="text-cyan-300 font-bold block">
                  {assessment.proximityDeviceCount} Nearby Bluetooth Beacons Scanned
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                <span className="text-slate-400 block mb-1">Vaccination Defense Status</span>
                <strong className="text-amber-300 font-bold block">Fully Vaccinated + Precaution Dose</strong>
              </div>
            </div>
          </div>

          {/* Guidelines & Advice Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-3xl p-6 bg-[#091522] border border-white/10 space-y-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-emerald-400" />
                <span>MoHFW Clinical Recommendations For You</span>
              </h3>
              <div className="space-y-3">
                {assessment.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-200 leading-relaxed">{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Helplines */}
            <div className="rounded-3xl p-6 bg-[#091522] border border-white/10 space-y-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-amber-400" />
                <span>National Emergency Lines</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <strong className="text-white block font-bold">National Health Helpline</strong>
                    <span className="text-slate-400">Toll-Free 24x7</span>
                  </div>
                  <a href="tel:1075" className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-black">
                    1075
                  </a>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <strong className="text-white block font-bold">ABDM / ABHA Support</strong>
                    <span className="text-slate-400">NHA Support Desk</span>
                  </div>
                  <a href="tel:14477" className="px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 font-black">
                    14477
                  </a>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <strong className="text-white block font-bold">Ambulance Service</strong>
                    <span className="text-slate-400">Pan-India Emergency</span>
                  </div>
                  <a href="tel:108" className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-black">
                    108 / 102
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: OFFICIAL ABHA DIGITAL CARD
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'card' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-black text-white">Official Ayushman Bharat Digital Health Card</h2>
            <p className="text-xs text-slate-400">
              Authorized government identity under National Health Authority (NHA) &amp; Ministry of Health and Family
              Welfare.
            </p>
          </div>

          {/* Interactive Digital Health Card */}
          <div className="max-w-md mx-auto perspective">
            <div
              className={`relative rounded-3xl shadow-2xl transition-all duration-500 border-2 overflow-hidden ${
                cardFlipped ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-700' : 'bg-white border-teal-500'
              }`}
            >
              {!cardFlipped ? (
                // FRONT OF CARD
                <div className="p-6 text-slate-900 space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center font-bold text-teal-700">
                        🇮🇳
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 block leading-tight">
                          ABHA Digital Health Card
                        </span>
                        <span className="text-[9px] text-slate-500 block">National Health Authority · NHA</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      UIDAI VERIFIED
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="flex items-center gap-4">
                    <div className="w-18 h-18 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-2xl font-bold text-white shadow-md shrink-0 border-2 border-white">
                      {profile.fullName.charAt(0)}
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-slate-900 leading-tight">{profile.fullName}</h3>
                      <div className="font-mono text-sm text-teal-700 font-extrabold tracking-wide">
                        {profile.abhaNumber}
                      </div>
                      <div className="text-xs text-slate-600 font-mono">PHR: {profile.abhaAddress}</div>
                    </div>
                  </div>

                  {/* Card Details Grid */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[10px]">
                    <div>
                      <span className="text-slate-500 block">Gender</span>
                      <strong className="text-slate-900">{profile.gender}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">DOB / Age</span>
                      <strong className="text-slate-900">{profile.dob}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Blood Group</span>
                      <strong className="text-teal-700 font-bold">{profile.bloodGroup}</strong>
                    </div>
                  </div>

                  {/* Organ Donor & Address */}
                  <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-[10px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-800 font-bold">NOTTO Organ Donor Pledge:</span>
                      <span className="font-mono text-emerald-900 font-black">{profile.nottoPledgeId}</span>
                    </div>
                    <div className="text-slate-600 truncate">Address: {profile.address}</div>
                  </div>

                  {/* QR Code Section */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 bg-white rounded-lg p-1 flex items-center justify-center border border-slate-200">
                        <QrCode className="w-10 h-10 text-slate-900" />
                      </div>
                      <span className="text-[9px] text-slate-500 max-w-[150px] leading-tight">
                        Scan at any ABDM OPD registration kiosk for paperless hospital token
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCardFlipped(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1 transition-colors"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Flip Card</span>
                    </button>
                  </div>
                </div>
              ) : (
                // BACK OF CARD
                <div className="p-6 text-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                      Instructions &amp; Verification
                    </span>
                    <button
                      type="button"
                      onClick={() => setCardFlipped(false)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] flex items-center gap-1"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Flip to Front</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 text-[11px] text-slate-300">
                    <p>
                      1. This ABHA Card is a digital health identity under Ayushman Bharat Digital Mission (ABDM),
                      Government of India.
                    </p>
                    <p>
                      2. Present this card or QR code at participating hospitals, clinics, and diagnostic labs across
                      India to link your medical records seamlessly.
                    </p>
                    <p>
                      3. Your health records are encrypted and accessible only with your explicit consent via the ABDM
                      Consent Manager.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[10px] space-y-1">
                    <div className="text-slate-400">Helpline: Toll-Free 14477 | 1800-11-4477</div>
                    <div className="text-slate-400">Website: https://abdm.gov.in</div>
                    <div className="text-slate-400">Email: abdm@nha.gov.in</div>
                  </div>

                  <div className="pt-2 text-center text-[9px] text-slate-500 font-mono">
                    ISSUED BY NATIONAL HEALTH AUTHORITY &middot; VALID PAN-INDIA
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => showToast('Official Government ABHA Card PDF downloading...')}
              className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-xl shadow-teal-600/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Official Card (PDF)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(profile.abhaNumber);
                showToast(`ABHA Number ${profile.abhaNumber} copied to clipboard.`);
              }}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>Copy ABHA ID</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: SCAN & SHARE (OPD TOKEN GENERATOR)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'scan_share' && (
        <div className="space-y-6">
          {/* Hero Banner */}
          <div
            className="rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1A1405 0%, #2A1F08 50%, #151004 100%)' }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-2xl font-black">
                  <Zap className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      ABDM Milestone 3
                    </span>
                    <span className="text-xs text-slate-400">Zero Physical Queues</span>
                  </div>
                  <h2 className="text-2xl font-black text-white mt-1">Scan &amp; Share OPD Registration</h2>
                  <p className="text-xs text-slate-300 max-w-xl mt-1 leading-relaxed">
                    Scan the QR code displayed at hospital reception or OPD registration kiosks. Instantly share your
                    verified demographic details and receive a direct queue token.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowScanModal(true)}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Simulate Scan at Hospital Kiosk</span>
              </button>
            </div>
          </div>

          {/* Active Tokens List */}
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Active OPD Registration Tokens ({scanTokens.length})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scanTokens.map((token) => (
                <div
                  key={token.id}
                  className="rounded-3xl p-6 bg-[#091522] border border-amber-500/30 relative overflow-hidden space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white truncate max-w-[240px]">{token.facilityName}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {token.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">OPD Queue Token</span>
                      <div className="text-3xl font-black text-amber-400 tracking-tight">{token.tokenNumber}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Assigned Counter</span>
                      <strong className="text-lg text-white font-extrabold block">{token.counterNumber}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/5 border border-white/5 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Queue Pos</span>
                      <strong className="text-white font-bold">#{token.queuePosition} in line</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Est. Wait</span>
                      <strong className="text-cyan-300 font-bold">~{token.estimatedWaitMins} mins</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Generated</span>
                      <strong className="text-slate-300 font-bold">{token.generatedAt}</strong>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 truncate">
                    Department: <span className="text-slate-200 font-semibold">{token.department}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: ABDM M3 CONSENT MANAGER
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'consents' && (
        <div className="space-y-6">
          <div className="rounded-3xl p-6 bg-[#091522] border border-white/10 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-purple-400" />
                  <span>ABDM Health Record Consent Manager (M3)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  You are the sole custodian of your medical data. Approve, customize, or revoke access requests from
                  verified health facilities.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                ABDM Electronic Consent Artefacts
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {consents.map((consent) => (
              <div
                key={consent.id}
                className={`rounded-3xl p-6 bg-[#091522] border transition-all space-y-4 ${
                  consent.status === 'REQUESTED'
                    ? 'border-purple-500/40 shadow-xl'
                    : consent.status === 'GRANTED'
                    ? 'border-emerald-500/30'
                    : 'border-white/10 opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-white">{consent.requesterName}</h4>
                      <span className="text-xs text-slate-500">&middot; {consent.department}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Ref: {consent.consentRequestId}</span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold w-fit ${
                      consent.status === 'REQUESTED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                        : consent.status === 'GRANTED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    Status: {consent.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="text-slate-300">
                    <strong className="text-white">Purpose: </strong> {consent.purposeDescription}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-white">Requested Health Data:</strong>
                    {consent.recordTypes.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300 text-[10px] font-semibold"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Valid through:{' '}
                    <span className="text-slate-200 font-mono">{new Date(consent.expiryDate).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  {consent.status === 'REQUESTED' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleConsentAction(consent.id, 'grant')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Grant Full Consent</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConsentAction(consent.id, 'deny')}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Deny Access</span>
                      </button>
                    </>
                  )}
                  {consent.status === 'GRANTED' && (
                    <button
                      type="button"
                      onClick={() => handleConsentAction(consent.id, 'revoke')}
                      className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Revoke Active Consent</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: LINKED HEALTH FACILITIES (HIPs)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'facilities' && (
        <div className="space-y-6">
          <div className="rounded-3xl p-6 bg-[#091522] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                <span>Linked Health Information Providers (HIPs)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Government &amp; private medical institutions linked with your ABHA ID for continuous record sync.
              </p>
            </div>
            <button
              type="button"
              onClick={() => showToast('Searching ABDM registry for new hospitals...')}
              className="px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Discover &amp; Link Hospital</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {facilities.map((fac) => (
              <div key={fac.id} className="rounded-3xl p-6 bg-[#091522] border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold block">{fac.hipId}</span>
                    <h3 className="text-sm font-extrabold text-white leading-tight">{fac.facilityName}</h3>
                    <span className="text-xs text-slate-400 block">
                      {fac.facilityType} &middot; {fac.state}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {fac.syncStatus}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Synced Records</span>
                    <strong className="text-white font-bold">{fac.recordsCount} Documents</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Last Synced</span>
                    <span className="text-slate-300 font-medium">{fac.lastSyncedAt}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: COWIN VACCINATION PASSPORT
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'vaccine' && (
        <div className="space-y-6">
          <div className="rounded-3xl p-6 bg-[#091522] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">MoHFW &middot; CoWIN</span>
                <span className="px-2 py-0.2 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300">
                  Fully Protected
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-1">Universal Immunization &amp; COVID-19 Passport</h2>
              <p className="text-xs text-slate-400">
                Digitally verifiable vaccination certificates linked with your ABHA number.
              </p>
            </div>

            <button
              type="button"
              onClick={() => showToast('Complete Vaccination Certificate PDF downloading...')}
              className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-600/20"
            >
              <Download className="w-4 h-4" />
              <span>Download Official Certificate</span>
            </button>
          </div>

          <div className="space-y-4">
            {vaccinations.map((vac, idx) => (
              <div key={vac.id} className="rounded-3xl p-6 bg-[#091522] border border-white/10 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-sm">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{vac.doseType}</h4>
                      <p className="text-xs text-rose-300 font-bold">{vac.vaccineName}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 w-fit">
                    {vac.certificateRef}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Date of Dose</span>
                    <strong className="text-white font-bold">{vac.dateAdministered}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Batch No.</span>
                    <strong className="text-cyan-300 font-mono font-bold">{vac.batchNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Vaccinated By</span>
                    <strong className="text-slate-200 font-bold">{vac.vaccinatedBy}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Vaccination Center</span>
                    <strong className="text-slate-200 font-bold truncate block">{vac.centerName}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 7: EMERGENCY SOS MEDICAL PASS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'emergency' && (
        <div className="space-y-6">
          <div
            className="rounded-3xl p-6 sm:p-8 border border-rose-500/30 shadow-2xl space-y-6"
            style={{ background: 'linear-gradient(135deg, #240707 0%, #380C0C 50%, #1A0404 100%)' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-rose-500/30">
                  SOS
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Emergency Medical Identification Pass</h2>
                  <p className="text-xs text-rose-200">
                    Accessible to emergency response teams and trauma care doctors.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-2xl bg-rose-500 text-white font-black text-sm">
                  Blood Group: {emergencyPass.bloodGroup}
                </span>
              </div>
            </div>

            {/* Quick Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Emergency Contacts */}
              <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-rose-300">
                  Designated Emergency Contacts
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-white/5 flex items-center justify-between">
                    <div>
                      <strong className="text-white block font-bold">{emergencyPass.primaryContact.name}</strong>
                      <span className="text-slate-400">{emergencyPass.primaryContact.relation}</span>
                    </div>
                    <a
                      href={`tel:${emergencyPass.primaryContact.phone}`}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-black"
                    >
                      Call SOS
                    </a>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 flex items-center justify-between">
                    <div>
                      <strong className="text-white block font-bold">{emergencyPass.secondaryContact.name}</strong>
                      <span className="text-slate-400">{emergencyPass.secondaryContact.relation}</span>
                    </div>
                    <a
                      href={`tel:${emergencyPass.secondaryContact.phone}`}
                      className="px-3 py-1.5 rounded-xl bg-white/10 text-slate-200 font-bold"
                    >
                      Call
                    </a>
                  </div>
                </div>
              </div>

              {/* Critical Medical Alerts */}
              <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-rose-300">Critical Clinical Alerts</h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-1">Known Drug Allergies:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {emergencyPass.allergies.map((a) => (
                        <span key={a} className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-xs">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2">
                    <span className="text-slate-400 block text-[11px] mb-1">Chronic Medical Conditions:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {emergencyPass.chronicConditions.map((c) => (
                        <span key={c} className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* NOTTO Organ Donor Pledge Banner */}
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <Award className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <div>
                  <strong className="text-emerald-200 block font-black text-sm">
                    Pledged National Organ Donor &middot; NOTTO Registry
                  </strong>
                  <span className="text-emerald-300/80">
                    Organs pledged: {emergencyPass.organDonor.pledgedOrgans}
                  </span>
                </div>
              </div>
              <span className="font-mono text-emerald-300 font-bold bg-emerald-900/60 px-3 py-1 rounded-xl w-fit">
                {emergencyPass.organDonor.pledgeId}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: INTERACTIVE AAROGYA SETU SELF-ASSESSMENT
      ───────────────────────────────────────────────────────────── */}
      {showAssessmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#091522] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <h3 className="text-lg font-black text-white">Aarogya Setu Clinical Self-Assessment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAssessmentModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>Step {assessmentStep} of 3</span>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`w-8 h-1.5 rounded-full ${
                      s <= assessmentStep ? 'bg-emerald-400' : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Step 1: Symptoms */}
            {assessmentStep === 1 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-300">
                  Are you experiencing any of the following symptoms right now?
                </p>
                <div className="space-y-2">
                  {['Fever (> 38°C / 100.4°F)', 'Dry Cough', 'Difficulty in Breathing', 'Loss of Smell or Taste', 'None of the above'].map(
                    (symptom) => {
                      const isChecked = selectedSymptoms.includes(symptom);
                      return (
                        <button
                          key={symptom}
                          type="button"
                          onClick={() => {
                            if (symptom === 'None of the above') {
                              setSelectedSymptoms(['None of the above']);
                            } else {
                              const withoutNone = selectedSymptoms.filter((x) => x !== 'None of the above');
                              if (isChecked) {
                                setSelectedSymptoms(withoutNone.filter((x) => x !== symptom));
                              } else {
                                setSelectedSymptoms([...withoutNone, symptom]);
                              }
                            }
                          }}
                          className={`w-full p-3 rounded-2xl text-left text-xs font-semibold border flex items-center justify-between transition-all ${
                            isChecked
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <span>{symptom}</span>
                          {isChecked && <Check className="w-4 h-4 text-emerald-400" />}
                        </button>
                      );
                    }
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setAssessmentStep(2)}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Continue to Medical History &rarr;
                </button>
              </div>
            )}

            {/* Step 2: Comorbidities */}
            {assessmentStep === 2 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-300">
                  Have you ever had any of the following pre-existing conditions?
                </p>
                <div className="space-y-2">
                  {[
                    'Diabetes Mellitus',
                    'Hypertension / Heart Disease',
                    'Chronic Lung Disease / Asthma',
                    'Kidney / Renal Disorder',
                    'None of the above',
                  ].map((cond) => {
                    const isChecked = selectedComorbidities.includes(cond);
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => {
                          if (cond === 'None of the above') {
                            setSelectedComorbidities(['None of the above']);
                          } else {
                            const withoutNone = selectedComorbidities.filter((x) => x !== 'None of the above');
                            if (isChecked) {
                              setSelectedComorbidities(withoutNone.filter((x) => x !== cond));
                            } else {
                              setSelectedComorbidities([...withoutNone, cond]);
                            }
                          }
                        }}
                        className={`w-full p-3 rounded-2xl text-left text-xs font-semibold border flex items-center justify-between transition-all ${
                          isChecked
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span>{cond}</span>
                        {isChecked && <Check className="w-4 h-4 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAssessmentStep(1)}
                    className="w-1/3 py-3 rounded-2xl bg-white/10 text-slate-300 font-bold text-xs"
                  >
                    &larr; Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssessmentStep(3)}
                    className="w-2/3 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer"
                  >
                    Continue to Exposure History &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Travel & Exposure */}
            {assessmentStep === 3 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-300">Exposure and travel inquiries (Last 14 Days):</p>
                <div className="space-y-3 text-xs">
                  <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={travelHistory}
                      onChange={(e) => setTravelHistory(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400"
                    />
                    <span className="text-slate-200">
                      I have traveled internationally or visited containment zones in the last 14 days.
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contactExposure}
                      onChange={(e) => setContactExposure(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400"
                    />
                    <span className="text-slate-200">
                      I have had close contact with a confirmed COVID-19 or respiratory infectious patient.
                    </span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAssessmentStep(2)}
                    className="w-1/3 py-3 rounded-2xl bg-white/10 text-slate-300 font-bold text-xs"
                  >
                    &larr; Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCompleteAssessment}
                    className="w-2/3 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-xl shadow-emerald-600/30 cursor-pointer"
                  >
                    Submit &amp; Calculate Risk Score
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SCAN & SHARE OPD KIOSK SIMULATOR
      ───────────────────────────────────────────────────────────── */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#091522] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-6 h-6 text-amber-400" />
                <h3 className="text-lg font-black text-white">Hospital OPD QR Scanner</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScanModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Select Healthcare Facility</label>
                <select
                  value={selectedHospital}
                  onChange={(e) => setSelectedHospital(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-black/40 border border-white/10 text-white outline-none"
                >
                  <option value="All India Institute of Medical Sciences (AIIMS), New Delhi">
                    AIIMS New Delhi — Central OPD Building
                  </option>
                  <option value="Safdarjung Hospital & VMMC, New Delhi">Safdarjung Hospital — Super Speciality OPD</option>
                  <option value="Memorial Diagnostic Pavilion (MiPAAS Node)">
                    Memorial Diagnostic Pavilion — Radiology & Imaging
                  </option>
                  <option value="Max Super Speciality Hospital, Saket">Max Healthcare — OPD Registration Tower A</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Department / Clinic</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-black/40 border border-white/10 text-white outline-none"
                >
                  <option value="Outpatient Department (OPD)">General Outpatient Department (OPD)</option>
                  <option value="Department of Cardiology & Chest Medicine">Department of Cardiology &amp; Chest Medicine</option>
                  <option value="Diagnostic Radiology & CT/MRI Imaging">Diagnostic Radiology &amp; CT/MRI Imaging</option>
                  <option value="Internal Medicine & Endocrinology">Internal Medicine &amp; Endocrinology</option>
                </select>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-300 space-y-1">
                <strong className="text-amber-300 font-bold block">ABDM Demographic Auto-Share:</strong>
                <span>
                  Your ABHA ID ({profile.abhaNumber}) will be transmitted securely to the hospital's Health Management
                  Information System (HMIS) to print your paperless OPD registration slip.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateToken}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-xs transition-all shadow-xl shadow-amber-500/20 cursor-pointer"
            >
              Generate Instant OPD Token
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
