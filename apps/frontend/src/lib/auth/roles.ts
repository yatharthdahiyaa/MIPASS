/**
 * Roles and permissions, mirroring apps/backend/app/services/rbac.py.
 * The backend is authoritative; this copy only drives UI (badges, gating hints).
 */

export type Role =
  | 'admin'
  | 'radiologist'
  | 'technician'
  | 'researcher'
  | 'auditor'
  | 'patient'
  | 'doctor'
  | 'doctor_pending'
  | 'guest';

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
  | 'phi:read'
  | 'ehr:self';

export interface RoleMeta {
  role: Role;
  title: string;
  description: string;
  badgeColor: string;
  badgeBg: string;
  borderColor: string;
}

export const ROLE_DEFINITIONS: Record<Role, RoleMeta> = {
  admin: {
    role: 'admin',
    title: 'System Administrator',
    description: 'Platform configuration, user roles, audit trails and model governance.',
    badgeColor: '#F5A623',
    badgeBg: 'rgba(245, 166, 35, 0.16)',
    borderColor: 'rgba(245, 166, 35, 0.35)',
  },
  radiologist: {
    role: 'radiologist',
    title: 'Radiologist',
    description: 'Uploads studies, reviews explainability maps, validates findings and signs reports.',
    badgeColor: '#7C5CFC',
    badgeBg: 'rgba(124, 92, 252, 0.16)',
    borderColor: 'rgba(124, 92, 252, 0.35)',
  },
  technician: {
    role: 'technician',
    title: 'Imaging Technologist',
    description: 'Uploads DICOM studies, verifies acquisition parameters and starts inference.',
    badgeColor: '#00DCCE',
    badgeBg: 'rgba(0, 220, 206, 0.16)',
    borderColor: 'rgba(0, 220, 206, 0.35)',
  },
  researcher: {
    role: 'researcher',
    title: 'Medical AI Researcher',
    description: 'Reviews de-identified results, attributions and benchmarks. No PHI access.',
    badgeColor: '#FF7869',
    badgeBg: 'rgba(255, 120, 105, 0.16)',
    borderColor: 'rgba(255, 120, 105, 0.35)',
  },
  auditor: {
    role: 'auditor',
    title: 'Compliance Auditor',
    description: 'Read-only oversight of activity, access events and data lifecycle.',
    badgeColor: '#98AED9',
    badgeBg: 'rgba(152, 174, 217, 0.16)',
    borderColor: 'rgba(152, 174, 217, 0.35)',
  },
  patient: {
    role: 'patient',
    title: 'Patient',
    description: 'Personal health record, daily logs, medicines and X-ray screening.',
    badgeColor: '#5FD3A8',
    badgeBg: 'rgba(95, 211, 168, 0.16)',
    borderColor: 'rgba(95, 211, 168, 0.35)',
  },
  doctor: {
    role: 'doctor',
    title: 'Doctor',
    description: 'Verified clinician: studies, AI findings and reports.',
    badgeColor: '#7C5CFC',
    badgeBg: 'rgba(124, 92, 252, 0.16)',
    borderColor: 'rgba(124, 92, 252, 0.35)',
  },
  doctor_pending: {
    role: 'doctor_pending',
    title: 'Doctor',
    description: 'Clinician account awaiting verification.',
    badgeColor: '#98AED9',
    badgeBg: 'rgba(152, 174, 217, 0.16)',
    borderColor: 'rgba(152, 174, 217, 0.3)',
  },
  guest: {
    role: 'guest',
    title: 'Guest',
    description: 'Not signed in.',
    badgeColor: '#8a8e97',
    badgeBg: 'rgba(138, 142, 151, 0.14)',
    borderColor: 'rgba(138, 142, 151, 0.3)',
  },
};

export function asRole(value: string | undefined | null): Role {
  return value && value in ROLE_DEFINITIONS ? (value as Role) : 'guest';
}
