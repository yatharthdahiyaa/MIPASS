export type ServiceStatus = 'active' | 'maintenance' | 'offline';

export type MaintenanceReason =
  | 'scheduled_maintenance'
  | 'model_calibration'
  | 'high_load'
  | 'emergency_fix'
  | 'compliance_review'
  | 'other';

export interface ServiceConfig {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  modality: string;
  badge: string;
  accent: string;
  bg: string;
  image: string;
  href: string;
  status: ServiceStatus;
  isListedOnHomepage: boolean;
  showInNavbar: boolean;
  maintenanceNotice: string;
  estimatedRestore: string;
  maintenanceReason: MaintenanceReason;
  lastUpdated: string;
  lastUpdatedBy: string;
}

export interface ServiceAuditEntry {
  id: string;
  timestamp: string;
  serviceId: string;
  serviceName: string;
  action: 'status_change' | 'homepage_visibility' | 'navbar_visibility' | 'notice_update' | 'bulk_action';
  changeDescription: string;
  performedBy: string;
  role: string;
}

export interface ServicesState {
  services: ServiceConfig[];
  auditLogs: ServiceAuditEntry[];
}
