import { invoke } from "@tauri-apps/api/core";

export interface Patient {
  id: string;
  name: string;
  dob: string;
  sex: "Male" | "Female" | "Other" | "Unknown";
  created_at: string;
}

export interface Case {
  id: string;
  patient_id: string;
  notes: string;
  created_at: string;
}

export interface RawFinding {
  label: string;
  confidence: number;
}

export interface ModelInfo {
  id: string;
  version: string;
  bundle_sha256: string;
}

export type DoctorAction =
  | "Accepted"
  | { Edited: { new_text: string } }
  | "Rejected";

export interface AiResult {
  id: string;
  case_id: string;
  model_info: ModelInfo;
  finding: RawFinding;
  input_ref: string;
  run_at: string;
  doctor_action: DoctorAction | null;
  doctor_user_id: string | null;
  action_at: string | null;
}

export interface SessionResponse {
  doctor_id: string;
  username: string;
  expires_at: string;
}

export interface ChainVerifyResponse {
  ok: boolean;
  message: string;
}

export const api = {
  login: (username: string, password: string) =>
    invoke<SessionResponse>("login", { username, password }),

  lockScreen: () => invoke<void>("lock_screen"),

  getSession: () => invoke<SessionResponse | null>("get_session"),

  getPatients: (query?: string, sortBy?: string) =>
    invoke<Patient[]>("get_patients", { query: query || null, sortBy: sortBy || null }),

  getPatient: (id: string) =>
    invoke<{ patient: Patient; cases: Case[] }>("get_patient", { id }),

  getCase: (id: string) =>
    invoke<{ case_info: Case; findings: AiResult[] }>("get_case", { id }),

  runAi: (caseId: string, inputRef: string) =>
    invoke<AiResult[]>("run_ai", { caseId, inputRef }),

  recordDoctorAction: (findingId: string, action: DoctorAction) =>
    invoke<void>("record_doctor_action", { findingId, action }),

  verifyAuditChain: () =>
    invoke<ChainVerifyResponse>("verify_audit_chain"),

  seedSyntheticData: () =>
    invoke<string>("seed_synthetic_data"),

  getModelInfo: () =>
    invoke<ModelInfo>("get_model_info"),
};
