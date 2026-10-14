/**
 * OpenEMR Management System Service Client for MiPAAS
 * 
 * Interacts with the native Python OpenEMR API & FHIR R4 bridge.
 * Features:
 *  - Master Patient Index (MPI) with demographics, allergies, & conditions
 *  - Clinical Encounters tracking
 *  - Procedure Orders Worklist (STAT, URGENT, ROUTINE) & DICOM Job Linking
 *  - Diagnostic Reports & Digital Signature certification
 *  - DICOM tag patient reconciliation
 *  - HL7 FHIR R4 standard translation endpoints
 *  - Hybrid SSO / IAM-RBAC practitioner synchronization
 */

export interface OpenEMRPatient {
  id: string;
  pid: number;
  pubpid: string; // MRN
  fname: string;
  lname: string;
  dob: string;
  sex: 'Male' | 'Female' | 'Other';
  phone_home?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  status: string;
  allergies: string[];
  chronic_conditions: string[];
  clinical_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OpenEMRUser {
  id: string;
  username: string;
  fname: string;
  lname: string;
  specialty?: string;
  npi?: string;
  facility_id?: string;
  authorized: boolean;
  role_mapping: string;
  email?: string;
}

export interface OpenEMREncounter {
  id: string;
  encounter: number;
  pid: string;
  date: string;
  reason: string;
  provider_id: string;
  status: 'planned' | 'in_progress' | 'finished' | 'cancelled';
  facility_id?: string;
}

export interface OpenEMRProcedureOrder {
  procedure_order_id: string;
  provider_id: string;
  patient_id: string;
  mrn: string;
  modality: 'CXR' | 'CT' | 'MRI' | 'MAMMO' | 'DERM';
  procedure_code: string;
  procedure_name: string;
  clinical_indication: string;
  order_priority: 'STAT' | 'URGENT' | 'ROUTINE';
  order_status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dicom_accession_number?: string;
  linked_job_id?: string;
  ordered_at?: string;
  completed_at?: string;
}

export interface OpenEMRProcedureReport {
  report_id: string;
  order_id: string;
  patient_id: string;
  provider_id: string;
  report_status: 'preliminary' | 'final' | 'amended' | 'corrected';
  report_notes: string;
  impression: string;
  ai_prediction_summary?: string;
  gradcam_heatmap_url?: string;
  signed_by?: string;
  signed_at?: string;
  created_at?: string;
}

export interface ReconcileResult {
  matched: boolean;
  patient: OpenEMRPatient | null;
  match_confidence: number;
  notes: string;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Try direct Flask endpoint on port 8080, fallback to Next.js rewrite /api/v1
  const directUrl = `http://localhost:8080${path}`;
  const proxyUrl = path;

  try {
    const res = await fetch(directUrl, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errorMessage =
        (typeof errBody.error === 'string'
          ? errBody.error
          : errBody.error?.message) || `Request failed with status ${res.status}`;
      throw new Error(errorMessage);
    }
    return await res.json();
  } catch {
    // If direct fails (e.g. browser CORS or network sandbox), try Next.js proxy rewrite
    const res = await fetch(proxyUrl, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errorMessage =
        (typeof errBody.error === 'string'
          ? errBody.error
          : errBody.error?.message) || `Request failed with status ${res.status}`;
      throw new Error(errorMessage);
    }
    return await res.json();
  }
}

export const openemrService = {
  /**
   * Health / Status
   */
  async getStatus(): Promise<{ status: string; service: string; version: string; registered_patients: number; active_orders: number }> {
    return apiFetch('/api/v1/emr/status');
  },

  /**
   * Patients (MPI)
   */
  async getPatients(query?: string): Promise<{ patients: OpenEMRPatient[]; count: number }> {
    const qs = query ? `?q=${encodeURIComponent(query)}` : '';
    return apiFetch(`/api/v1/emr/patients${qs}`);
  },

  async getPatient(id: string): Promise<{
    patient: OpenEMRPatient;
    encounters: OpenEMREncounter[];
    orders: OpenEMRProcedureOrder[];
  }> {
    return apiFetch(`/api/v1/emr/patients/${id}`);
  },

  async createPatient(patientData: Partial<OpenEMRPatient>): Promise<{ success: boolean; patient: OpenEMRPatient }> {
    return apiFetch('/api/v1/emr/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
  },

  /**
   * Reconcile DICOM metadata headers against OpenEMR MPI
   */
  async reconcileDicom(patientIdTag: string, patientNameTag?: string, dobTag?: string): Promise<ReconcileResult> {
    return apiFetch('/api/v1/emr/patients/reconcile-dicom', {
      method: 'POST',
      body: JSON.stringify({
        patient_id_tag: patientIdTag,
        patient_name_tag: patientNameTag,
        dob_tag: dobTag,
      }),
    });
  },

  /**
   * Procedure Orders Worklist
   */
  async getOrders(params?: { status?: string; patient_id?: string; priority?: string }): Promise<{ orders: OpenEMRProcedureOrder[]; count: number }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.patient_id) searchParams.set('patient_id', params.patient_id);
    if (params?.priority) searchParams.set('priority', params.priority);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiFetch(`/api/v1/emr/orders${qs}`);
  },

  async createOrder(orderData: Partial<OpenEMRProcedureOrder>): Promise<{ success: boolean; order: OpenEMRProcedureOrder }> {
    return apiFetch('/api/v1/emr/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  async linkJobToOrder(orderId: string, jobId: string): Promise<{ success: boolean; order: OpenEMRProcedureOrder }> {
    return apiFetch(`/api/v1/emr/orders/${orderId}/link-job`, {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId }),
    });
  },

  async fileReport(
    orderId: string,
    payload: {
      notes: string;
      impression: string;
      ai_prediction_summary?: string;
      gradcam_heatmap_url?: string;
      signed_by: string;
    }
  ): Promise<{ success: boolean; report: OpenEMRProcedureReport }> {
    return apiFetch(`/api/v1/emr/orders/${orderId}/file-report`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Encounters
   */
  async getEncounters(patientId?: string): Promise<{ encounters: OpenEMREncounter[]; count: number }> {
    const qs = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '';
    return apiFetch(`/api/v1/emr/encounters${qs}`);
  },

  async createEncounter(data: Partial<OpenEMREncounter>): Promise<{ success: boolean; encounter: OpenEMREncounter }> {
    return apiFetch('/api/v1/emr/encounters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Practitioners / Users & IAM-RBAC Sync
   */
  async getUsers(): Promise<{ users: OpenEMRUser[]; count: number }> {
    return apiFetch('/api/v1/emr/users');
  },

  async syncRbacUser(userData: {
    id: string;
    username: string;
    email?: string;
    role: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ success: boolean; user: OpenEMRUser; action: string }> {
    return apiFetch('/api/v1/emr/sync-rbac', {
      method: 'POST',
      body: JSON.stringify({
        iam_user_id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        first_name: userData.firstName,
        last_name: userData.lastName,
      }),
    });
  },

  /**
   * HL7 FHIR R4 Resources
   */
  async getFhirResource<T = unknown>(resourceType: 'Patient' | 'Practitioner' | 'Encounter' | 'ServiceRequest' | 'DiagnosticReport', id: string): Promise<T> {
    return apiFetch(`/api/v1/emr/fhir/${resourceType}/${id}`);
  },
};
