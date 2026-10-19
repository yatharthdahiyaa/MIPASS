/**
 * RBAC Types and Definitions for MiPAAS
 */

export type Role = 'admin' | 'radiologist' | 'technician' | 'researcher' | 'auditor' | 'doctor' | 'patient';

export type Permission =
  | 'jobs:create'
  | 'jobs:read'
  | 'jobs:read_all'
  | 'jobs:delete'
  | 'results:read'
  | 'xai:read'
  | 'reports:sign'
  | 'reports:export'
  | 'models:read'
  | 'models:manage'
  | 'models:benchmark'
  | 'users:manage'
  | 'audit:read'
  | 'phi:read';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleTitle: string;
  department: string;
  organization: string;
  avatar?: string;
  permissions: Permission[];
}

export interface RoleMeta {
  role: Role;
  title: string;
  shortDesc: string;
  description: string;
  badgeColor: string;
  badgeBg: string;
  borderColor: string;
  iconName: string;
  permissions: Permission[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: Role;
  action: string;
  resource: string;
  decision: 'allow' | 'deny';
  details?: Record<string, unknown>;
}

export const ROLE_DEFINITIONS: Record<Role, RoleMeta> = {
  radiologist: {
    role: 'radiologist',
    title: 'Thoracic Radiologist',
    shortDesc: 'Clinical diagnostic sign-off & XAI inspection',
    description: 'Diagnostician. Uploads CT/MRI studies, inspects Grad-CAM++ & SHAP attributions, validates findings, and signs diagnostic reports.',
    badgeColor: '#7C5CFC',
    badgeBg: 'rgba(124, 92, 252, 0.16)',
    borderColor: 'rgba(124, 92, 252, 0.35)',
    iconName: 'Stethoscope',
    permissions: [
      'jobs:create',
      'jobs:read',
      'results:read',
      'xai:read',
      'reports:sign',
      'reports:export',
      'models:read',
      'phi:read',
    ],
  },
  technician: {
    role: 'technician',
    title: 'Imaging Technologist',
    shortDesc: 'Scan ingestion & pipeline orchestration',
    description: 'Lead CT technologist. Uploads DICOM studies, triggers isotropic resampling & AI inference, monitors queue status.',
    badgeColor: '#00DCCE',
    badgeBg: 'rgba(0, 220, 206, 0.16)',
    borderColor: 'rgba(0, 220, 206, 0.35)',
    iconName: 'Activity',
    permissions: [
      'jobs:create',
      'jobs:read',
      'results:read',
      'models:read',
      'phi:read',
    ],
  },
  researcher: {
    role: 'researcher',
    title: 'Medical AI Researcher',
    shortDesc: 'De-identified model benchmark & attribution analysis',
    description: 'Algorithm investigator. Runs feature attribution sweeps, benchmarks Sybil risk accuracy across cohorts on de-identified scans.',
    badgeColor: '#FF7869',
    badgeBg: 'rgba(255, 120, 105, 0.16)',
    borderColor: 'rgba(255, 120, 105, 0.35)',
    iconName: 'Cpu',
    permissions: [
      'jobs:read',
      'results:read',
      'xai:read',
      'models:read',
      'models:benchmark',
    ],
  },
  admin: {
    role: 'admin',
    title: 'System Administrator',
    shortDesc: 'Full platform governance & user role management',
    description: 'IT & Security Lead. Configures model registry, manages user roles, reviews HIPAA audit logs, oversees Cloud Run workers.',
    badgeColor: '#F5A623',
    badgeBg: 'rgba(245, 166, 35, 0.16)',
    borderColor: 'rgba(245, 166, 35, 0.35)',
    iconName: 'ShieldCheck',
    permissions: [
      'jobs:create',
      'jobs:read',
      'jobs:read_all',
      'jobs:delete',
      'results:read',
      'xai:read',
      'reports:sign',
      'reports:export',
      'models:read',
      'models:manage',
      'models:benchmark',
      'users:manage',
      'audit:read',
      'phi:read',
    ],
  },
  auditor: {
    role: 'auditor',
    title: 'Compliance Auditor',
    shortDesc: 'HIPAA compliance & immutable audit oversight',
    description: 'Quality & Privacy officer. Read-only oversight of system activities, access logs, and data de-identification logs.',
    badgeColor: '#98AED9',
    badgeBg: 'rgba(152, 174, 217, 0.16)',
    borderColor: 'rgba(152, 174, 217, 0.35)',
    iconName: 'FileCheck2',
    permissions: [
      'jobs:read',
      'jobs:read_all',
      'audit:read',
      'models:read',
    ],
  },
  doctor: {
    role: 'doctor',
    title: 'Attending Physician & Clinician',
    shortDesc: 'Clinical patient consultations & medical orders',
    description: 'Lead Physician. Manages appointments, patient records, prescription orders, lab review, and care plans.',
    badgeColor: '#0F9D9A',
    badgeBg: 'rgba(15, 157, 154, 0.16)',
    borderColor: 'rgba(15, 157, 154, 0.35)',
    iconName: 'Stethoscope',
    permissions: [
      'jobs:read',
      'results:read',
      'reports:sign',
      'reports:export',
      'phi:read',
    ],
  },
  patient: {
    role: 'patient',
    title: 'Registered Patient',
    shortDesc: 'Personal health portal & medical record access',
    description: 'Patient. Accesses personal test results, appointments, care plan, medications, and messages their care team.',
    badgeColor: '#0F9D9A',
    badgeBg: 'rgba(15, 157, 154, 0.16)',
    borderColor: 'rgba(15, 157, 154, 0.35)',
    iconName: 'Heart',
    permissions: [
      'results:read',
      'phi:read',
    ],
  },
};

export const CLINICAL_PERSONAS: Record<string, UserProfile> = {
  'doc-01': {
    id: 'doc-01',
    name: 'Dr. Elena Vance, MD',
    email: 'elena.vance@mipaas.health',
    role: 'doctor',
    roleTitle: 'Internal Medicine & Lead Clinician',
    department: 'Outpatient Clinical Medicine',
    organization: 'CareNest Hospital System',
    permissions: [
      'jobs:read',
      'results:read',
      'reports:sign',
      'reports:export',
      'phi:read',
    ],
  },
  'pat-01': {
    id: 'pat-01',
    name: 'Alex Taylor',
    email: 'alex.taylor@carenest.health',
    role: 'patient',
    roleTitle: 'Registered Patient',
    department: 'Preventive Care',
    organization: 'CareNest Health Plan',
    permissions: [
      'results:read',
      'phi:read',
    ],
  },
  'rad-01': {
    id: 'rad-01',
    name: 'Dr. Elena Vance',
    email: 'elena.vance@mipaas.health',
    role: 'radiologist',
    roleTitle: 'Chief Thoracic Radiologist',
    department: 'Cardiothoracic Imaging',
    organization: 'Mount Sinai Health System',
    permissions: ROLE_DEFINITIONS.radiologist.permissions,
  },
  'tech-01': {
    id: 'tech-01',
    name: 'Marcus Chen, RT(R)(CT)',
    email: 'marcus.chen@mipaas.health',
    role: 'technician',
    roleTitle: 'Lead CT Imaging Technologist',
    department: 'Advanced Imaging Pavilion',
    organization: 'Mount Sinai Health System',
    permissions: ROLE_DEFINITIONS.technician.permissions,
  },
  'res-01': {
    id: 'res-01',
    name: 'Dr. Sarah Lin, PhD',
    email: 'sarah.lin@mipaas.research',
    role: 'researcher',
    roleTitle: 'Principal AI Scientist',
    department: 'Biomedical AI & Oncology Lab',
    organization: 'Stanford AIMI Center',
    permissions: ROLE_DEFINITIONS.researcher.permissions,
  },
  'admin-01': {
    id: 'admin-01',
    name: 'Arthur Davis, CISSP',
    email: 'arthur.davis@mipaas.health',
    role: 'admin',
    roleTitle: 'Director of Clinical Infosec',
    department: 'Hospital IT & Security Operations',
    organization: 'MiPAAS Enterprise Cloud',
    permissions: ROLE_DEFINITIONS.admin.permissions,
  },
  'aud-01': {
    id: 'aud-01',
    name: 'Arthur Pendelton, CHPC',
    email: 'a.pendelton@mipaas.health',
    role: 'auditor',
    roleTitle: 'Clinical Compliance Officer',
    department: 'Regulatory & HIPAA Compliance',
    organization: 'Healthcare Oversight Commission',
    permissions: ROLE_DEFINITIONS.auditor.permissions,
  },
};

