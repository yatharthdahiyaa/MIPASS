-- =====================================================================
-- MiPAAS Central Database Schema (PostgreSQL 16 / ANSI SQL)
-- 18 Relational Tables across IAM, Clinical (OpenEMR), Eka.care, and AI
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. IAM, RBAC & AUDIT LOGS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'technician',
    department VARCHAR(100) DEFAULT 'Diagnostic Radiology',
    organization VARCHAR(150) DEFAULT 'MiPAAS Health System',
    avatar VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_users_username ON users(username);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_role ON users(role);

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    permissions_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_roles_name ON roles(name);

CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(50),
    user_agent VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_user_sessions_token_hash ON user_sessions(token_hash);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'success',
    ip_address VARCHAR(50),
    user_agent VARCHAR(255),
    details_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS ix_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action_created ON audit_logs(action, created_at);

-- ---------------------------------------------------------------------
-- 2. CLINICAL & OPENEMR (MASTER PATIENT INDEX, ENCOUNTERS, ORDERS)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinical_providers (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    fname VARCHAR(100) NOT NULL,
    lname VARCHAR(100) NOT NULL,
    title VARCHAR(50) DEFAULT 'Dr.',
    specialty VARCHAR(150),
    npi VARCHAR(20) UNIQUE,
    email VARCHAR(255),
    phone VARCHAR(50),
    facility_name VARCHAR(150) DEFAULT 'Memorial Diagnostic Pavilion',
    role_mapping VARCHAR(50) DEFAULT 'radiologist',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_clinical_providers_npi ON clinical_providers(npi);

CREATE TABLE IF NOT EXISTS clinical_patients (
    id VARCHAR(64) PRIMARY KEY,
    mrn VARCHAR(50) UNIQUE NOT NULL,
    fname VARCHAR(100) NOT NULL,
    lname VARCHAR(100) NOT NULL,
    dob VARCHAR(20) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    blood_group VARCHAR(10),
    phone VARCHAR(50),
    email VARCHAR(255),
    street VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    insurance_provider VARCHAR(150),
    insurance_id VARCHAR(100),
    allergies_json TEXT,
    conditions_json TEXT,
    abha_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_clinical_patients_mrn ON clinical_patients(mrn);
CREATE INDEX IF NOT EXISTS ix_clinical_patients_abha_id ON clinical_patients(abha_id);

CREATE TABLE IF NOT EXISTS clinical_encounters (
    id VARCHAR(64) PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL REFERENCES clinical_patients(id) ON DELETE CASCADE,
    provider_id VARCHAR(64) REFERENCES clinical_providers(id) ON DELETE SET NULL,
    encounter_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    encounter_type VARCHAR(100) NOT NULL DEFAULT 'diagnostic_imaging',
    facility_name VARCHAR(150) DEFAULT 'Memorial Diagnostic Pavilion',
    reason_for_visit VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_clinical_encounters_patient_id ON clinical_encounters(patient_id);
CREATE INDEX IF NOT EXISTS ix_clinical_encounters_status ON clinical_encounters(status);

CREATE TABLE IF NOT EXISTS procedure_orders (
    id VARCHAR(64) PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id VARCHAR(64) NOT NULL REFERENCES clinical_patients(id) ON DELETE CASCADE,
    encounter_id VARCHAR(64) REFERENCES clinical_encounters(id) ON DELETE SET NULL,
    ordering_provider_id VARCHAR(64) REFERENCES clinical_providers(id) ON DELETE SET NULL,
    procedure_code VARCHAR(50) NOT NULL,
    procedure_name VARCHAR(200) NOT NULL,
    modality VARCHAR(20) NOT NULL,
    body_site VARCHAR(100),
    clinical_indication TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'routine',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    order_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    linked_job_id VARCHAR(64),
    accession_number VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_procedure_orders_order_number ON procedure_orders(order_number);
CREATE INDEX IF NOT EXISTS ix_procedure_orders_patient_id ON procedure_orders(patient_id);
CREATE INDEX IF NOT EXISTS ix_procedure_orders_modality ON procedure_orders(modality);
CREATE INDEX IF NOT EXISTS ix_procedure_orders_status ON procedure_orders(status);

CREATE TABLE IF NOT EXISTS procedure_reports (
    id VARCHAR(64) PRIMARY KEY,
    report_number VARCHAR(50) UNIQUE NOT NULL,
    order_id VARCHAR(64) UNIQUE NOT NULL REFERENCES procedure_orders(id) ON DELETE CASCADE,
    patient_id VARCHAR(64) NOT NULL REFERENCES clinical_patients(id) ON DELETE CASCADE,
    radiologist_id VARCHAR(64) REFERENCES clinical_providers(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'preliminary',
    findings TEXT,
    impression TEXT,
    recommendations TEXT,
    bi_rads_score VARCHAR(20),
    critical_findings_alert BOOLEAN NOT NULL DEFAULT FALSE,
    signed_by VARCHAR(150),
    signed_at TIMESTAMPTZ,
    signature_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_procedure_reports_order_id ON procedure_reports(order_id);
CREATE INDEX IF NOT EXISTS ix_procedure_reports_status ON procedure_reports(status);

-- ---------------------------------------------------------------------
-- 3. CONSUMER HEALTH & EKA.CARE PHR HUB (ABDM, VITALS, MEDS)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS family_members (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    relation VARCHAR(50) NOT NULL,
    age INTEGER NOT NULL,
    gender VARCHAR(20) NOT NULL,
    abha_id VARCHAR(50) UNIQUE NOT NULL,
    blood_group VARCHAR(10),
    avatar_color VARCHAR(100) DEFAULT 'from-teal-500 to-emerald-600',
    primary_condition VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_family_members_abha_id ON family_members(abha_id);

CREATE TABLE IF NOT EXISTS medications (
    id VARCHAR(64) PRIMARY KEY,
    member_id VARCHAR(64) NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    timing VARCHAR(50) NOT NULL,
    instruction VARCHAR(50) NOT NULL,
    prescribed_by VARCHAR(150),
    refill_days_left INTEGER DEFAULT 30,
    time_slot VARCHAR(50) NOT NULL,
    taken_today BOOLEAN NOT NULL DEFAULT FALSE,
    last_taken_date VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_medications_member_id ON medications(member_id);

CREATE TABLE IF NOT EXISTS vital_records (
    id VARCHAR(64) PRIMARY KEY,
    member_id VARCHAR(64) NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    vital_type VARCHAR(50) NOT NULL,
    value VARCHAR(50) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Normal',
    recorded_at VARCHAR(100) NOT NULL,
    trend VARCHAR(20) DEFAULT 'stable',
    target_range VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_vitals_member_type ON vital_records(member_id, vital_type);

CREATE TABLE IF NOT EXISTS health_records (
    id VARCHAR(64) PRIMARY KEY,
    member_id VARCHAR(64) NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    doctor_or_lab VARCHAR(150) NOT NULL,
    record_date VARCHAR(50) NOT NULL,
    file_type VARCHAR(50) DEFAULT 'PDF',
    file_size VARCHAR(50) DEFAULT '1.0 MB',
    storage_uri VARCHAR(500),
    ai_key_summary TEXT,
    tags_json TEXT,
    extracted_parameters_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_health_records_member_id ON health_records(member_id);
CREATE INDEX IF NOT EXISTS ix_health_records_category ON health_records(category);

CREATE TABLE IF NOT EXISTS consumer_appointments (
    id VARCHAR(64) PRIMARY KEY,
    member_id VARCHAR(64) NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    doctor_name VARCHAR(150) NOT NULL,
    specialty VARCHAR(150) NOT NULL,
    hospital VARCHAR(200) NOT NULL,
    appointment_date VARCHAR(50) NOT NULL,
    appointment_time VARCHAR(50) NOT NULL,
    token_number INTEGER DEFAULT 1,
    appointment_type VARCHAR(50) DEFAULT 'In-Clinic',
    status VARCHAR(50) DEFAULT 'Confirmed',
    queue_wait_mins INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_consumer_appointments_member_id ON consumer_appointments(member_id);
CREATE INDEX IF NOT EXISTS ix_consumer_appointments_status ON consumer_appointments(status);

-- ---------------------------------------------------------------------
-- 4. DICOM IMAGING, AI PIPELINES & 9 CLINICAL AGENTS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dicom_studies (
    id VARCHAR(64) PRIMARY KEY,
    patient_id VARCHAR(64) REFERENCES clinical_patients(id) ON DELETE SET NULL,
    study_instance_uid VARCHAR(128) UNIQUE NOT NULL,
    study_date VARCHAR(20),
    accession_number VARCHAR(50),
    modality VARCHAR(20) NOT NULL,
    study_description VARCHAR(255),
    num_series INTEGER DEFAULT 1,
    num_instances INTEGER DEFAULT 1,
    patient_age VARCHAR(20),
    patient_gender VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_dicom_studies_uid ON dicom_studies(study_instance_uid);
CREATE INDEX IF NOT EXISTS ix_dicom_studies_patient_id ON dicom_studies(patient_id);
CREATE INDEX IF NOT EXISTS ix_dicom_studies_modality ON dicom_studies(modality);

CREATE TABLE IF NOT EXISTS dicom_series (
    id VARCHAR(64) PRIMARY KEY,
    study_id VARCHAR(64) NOT NULL REFERENCES dicom_studies(id) ON DELETE CASCADE,
    series_instance_uid VARCHAR(128) UNIQUE NOT NULL,
    series_number INTEGER DEFAULT 1,
    modality VARCHAR(20) NOT NULL,
    series_description VARCHAR(255),
    num_instances INTEGER DEFAULT 1,
    slice_thickness DOUBLE PRECISION,
    pixel_spacing_x DOUBLE PRECISION,
    pixel_spacing_y DOUBLE PRECISION,
    gcs_uri VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_dicom_series_study_id ON dicom_series(study_id);
CREATE INDEX IF NOT EXISTS ix_dicom_series_uid ON dicom_series(series_instance_uid);

CREATE TABLE IF NOT EXISTS diagnostic_jobs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    patient_id VARCHAR(64) REFERENCES clinical_patients(id) ON DELETE SET NULL,
    study_id VARCHAR(64) REFERENCES dicom_studies(id) ON DELETE SET NULL,
    disease_id VARCHAR(50) NOT NULL,
    model_name VARCHAR(50) NOT NULL,
    modality VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'awaiting_upload',
    progress_pct INTEGER DEFAULT 0,
    error_stage VARCHAR(50),
    error_message TEXT,
    input_gcs_uri VARCHAR(500),
    preprocessed_uri VARCHAR(500),
    predictions_json TEXT,
    xai_json TEXT,
    segmentation_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_diagnostic_jobs_status ON diagnostic_jobs(status);
CREATE INDEX IF NOT EXISTS ix_diagnostic_jobs_disease_id ON diagnostic_jobs(disease_id);

CREATE TABLE IF NOT EXISTS agent_workflow_runs (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL REFERENCES diagnostic_jobs(id) ON DELETE CASCADE,
    agent_id VARCHAR(50) NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    step_order INTEGER DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    execution_time_ms INTEGER DEFAULT 0,
    inputs_json TEXT,
    outputs_json TEXT,
    logs_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_agent_workflow_runs_job_id ON agent_workflow_runs(job_id);
CREATE INDEX IF NOT EXISTS ix_agent_workflow_runs_agent_id ON agent_workflow_runs(agent_id);

-- ---------------------------------------------------------------------
-- 5. ABDM, ABHA & AAROGYA SETU GOVERNMENT HEALTH ECOSYSTEM
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS abha_profiles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    abha_number VARCHAR(20) UNIQUE NOT NULL,
    abha_address VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    dob VARCHAR(20) NOT NULL,
    blood_group VARCHAR(10),
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    state VARCHAR(100) DEFAULT 'Delhi',
    district VARCHAR(100) DEFAULT 'New Delhi',
    pincode VARCHAR(20) DEFAULT '110029',
    kyc_status VARCHAR(50) NOT NULL DEFAULT 'UIDAI_VERIFIED',
    notto_pledge_id VARCHAR(100),
    photo_uri VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_abha_profiles_number ON abha_profiles(abha_number);
CREATE INDEX IF NOT EXISTS ix_abha_profiles_address ON abha_profiles(abha_address);

CREATE TABLE IF NOT EXISTS abdm_consents (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    consent_request_id VARCHAR(64) UNIQUE NOT NULL,
    requester_name VARCHAR(150) NOT NULL,
    requester_type VARCHAR(50) DEFAULT 'Hospital',
    purpose_code VARCHAR(50) NOT NULL,
    purpose_description VARCHAR(255),
    record_types_json TEXT NOT NULL,
    date_range_from VARCHAR(50),
    date_range_to VARCHAR(50),
    expiry_date VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_abdm_consents_user_id ON abdm_consents(user_id);
CREATE INDEX IF NOT EXISTS ix_abdm_consents_status ON abdm_consents(status);

CREATE TABLE IF NOT EXISTS abdm_linked_facilities (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    hip_id VARCHAR(64) NOT NULL,
    facility_name VARCHAR(200) NOT NULL,
    facility_type VARCHAR(100) DEFAULT 'General Hospital',
    state VARCHAR(100) DEFAULT 'Delhi',
    linked_date VARCHAR(50) NOT NULL,
    sync_status VARCHAR(50) DEFAULT 'SYNCED',
    records_count INTEGER DEFAULT 0,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_abdm_facilities_user_id ON abdm_linked_facilities(user_id);
CREATE INDEX IF NOT EXISTS ix_abdm_facilities_hip_id ON abdm_linked_facilities(hip_id);

CREATE TABLE IF NOT EXISTS aarogya_setu_assessments (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    risk_level VARCHAR(50) NOT NULL DEFAULT 'SAFE_LOW',
    score INTEGER NOT NULL DEFAULT 0,
    symptoms_json TEXT,
    comorbidities_json TEXT,
    travel_history BOOLEAN DEFAULT FALSE,
    contact_exposure BOOLEAN DEFAULT FALSE,
    recommendations_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_aarogya_assessments_user_id ON aarogya_setu_assessments(user_id);

CREATE TABLE IF NOT EXISTS vaccination_records (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    vaccine_name VARCHAR(100) NOT NULL,
    dose_type VARCHAR(50) NOT NULL,
    date_administered VARCHAR(50) NOT NULL,
    batch_number VARCHAR(50) NOT NULL,
    vaccinated_by VARCHAR(150),
    center_name VARCHAR(200) NOT NULL,
    certificate_ref VARCHAR(100) UNIQUE NOT NULL,
    qr_payload TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_vaccination_records_user_id ON vaccination_records(user_id);
CREATE INDEX IF NOT EXISTS ix_vaccination_records_ref ON vaccination_records(certificate_ref);

CREATE TABLE IF NOT EXISTS scan_and_share_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    token_number VARCHAR(50) NOT NULL,
    facility_name VARCHAR(200) NOT NULL,
    department VARCHAR(100) NOT NULL,
    counter_number VARCHAR(20) DEFAULT 'Counter 4',
    queue_position INTEGER DEFAULT 3,
    estimated_wait_mins INTEGER DEFAULT 15,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_scan_tokens_user_id ON scan_and_share_tokens(user_id);
CREATE INDEX IF NOT EXISTS ix_scan_tokens_number ON scan_and_share_tokens(token_number);

