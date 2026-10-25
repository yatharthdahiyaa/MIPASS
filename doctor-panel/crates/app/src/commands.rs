use crate::worker_client::SharedWorker;
use audit::events::AuditEvent;
use audit::log::AuditEntry;
use chrono::{Duration, Utc};
use doctor_core::types::{AiResult, Case, DoctorAction, Patient, RawFinding, Session};
use infer::ModelInput;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use uuid::Uuid;

pub type SharedDb = Arc<Mutex<Connection>>;
pub type SharedSession = Arc<Mutex<Option<Session>>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionResponse {
    pub doctor_id: String,
    pub username: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PatientDetailResponse {
    pub patient: Patient,
    pub cases: Vec<Case>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CaseDetailResponse {
    pub case_info: Case,
    pub findings: Vec<AiResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChainVerifyResponse {
    pub ok: bool,
    pub message: String,
}

#[tauri::command]
pub async fn login(
    username: String,
    password: String,
    db: State<'_, SharedDb>,
    session: State<'_, SharedSession>,
) -> Result<SessionResponse, String> {
    let conn = db.lock().await;

    match store::doctors::verify(&conn, &username, &password) {
        Ok(doc) => {
            let _ = store::doctors::touch_login(&conn, &doc.id);
            let expires_at = Utc::now() + Duration::minutes(15);
            let s = Session {
                doctor_id: doc.id,
                doctor_username: doc.username.clone(),
                expires_at,
            };

            let _ = audit::log::append_event(
                &conn,
                &AuditEvent::Login {
                    doctor_id: doc.id,
                    success: true,
                },
            );

            let mut sess_guard = session.lock().await;
            *sess_guard = Some(s);

            Ok(SessionResponse {
                doctor_id: doc.id.to_string(),
                username: doc.username,
                expires_at: expires_at.to_rfc3339(),
            })
        }
        Err(e) => {
            let _ = audit::log::append_event(
                &conn,
                &AuditEvent::Login {
                    doctor_id: Uuid::nil(),
                    success: false,
                },
            );
            Err(format!("Authentication failed: {e}"))
        }
    }
}

#[tauri::command]
pub async fn lock_screen(
    db: State<'_, SharedDb>,
    session: State<'_, SharedSession>,
) -> Result<(), String> {
    let mut sess_guard = session.lock().await;
    if let Some(s) = sess_guard.take() {
        let conn = db.lock().await;
        let _ = audit::log::append_event(
            &conn,
            &AuditEvent::AutoLock {
                doctor_id: s.doctor_id,
            },
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn get_session(
    session: State<'_, SharedSession>,
) -> Result<Option<SessionResponse>, String> {
    let mut sess_guard = session.lock().await;
    if let Some(s) = &*sess_guard {
        if s.is_expired() {
            *sess_guard = None;
            return Ok(None);
        }
        return Ok(Some(SessionResponse {
            doctor_id: s.doctor_id.to_string(),
            username: s.doctor_username.clone(),
            expires_at: s.expires_at.to_rfc3339(),
        }));
    }
    Ok(None)
}

#[tauri::command]
pub async fn get_patients(
    query: Option<String>,
    sort_by: Option<String>,
    db: State<'_, SharedDb>,
) -> Result<Vec<Patient>, String> {
    let conn = db.lock().await;
    let sort = match sort_by.as_deref() {
        Some("dob") => store::patients::PatientSort::Dob,
        Some("created") => store::patients::PatientSort::Created,
        _ => store::patients::PatientSort::Name,
    };
    store::patients::list(&conn, query.as_deref(), sort).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_patient(
    id: String,
    db: State<'_, SharedDb>,
) -> Result<PatientDetailResponse, String> {
    let pid = Uuid::parse_str(&id).map_err(|e| format!("Invalid UUID: {e}"))?;
    let conn = db.lock().await;

    let patient = store::patients::get(&conn, &pid).map_err(|e| e.to_string())?;
    let cases = store::cases::list_for_patient(&conn, &pid).map_err(|e| e.to_string())?;

    let _ = audit::log::append_event(
        &conn,
        &AuditEvent::RecordViewed {
            entity_type: "patient".to_string(),
            entity_id: pid,
        },
    );

    Ok(PatientDetailResponse { patient, cases })
}

#[tauri::command]
pub async fn get_case(id: String, db: State<'_, SharedDb>) -> Result<CaseDetailResponse, String> {
    let cid = Uuid::parse_str(&id).map_err(|e| format!("Invalid UUID: {e}"))?;
    let conn = db.lock().await;

    let case_info = store::cases::get(&conn, &cid).map_err(|e| e.to_string())?;
    let findings = store::findings::list_for_case(&conn, &cid).map_err(|e| e.to_string())?;

    let _ = audit::log::append_event(
        &conn,
        &AuditEvent::RecordViewed {
            entity_type: "case".to_string(),
            entity_id: cid,
        },
    );

    Ok(CaseDetailResponse {
        case_info,
        findings,
    })
}

#[tauri::command]
pub async fn run_ai(
    case_id: String,
    input_ref: String,
    db: State<'_, SharedDb>,
    worker: State<'_, SharedWorker>,
    session: State<'_, SharedSession>,
) -> Result<Vec<AiResult>, String> {
    let cid = Uuid::parse_str(&case_id).map_err(|e| format!("Invalid UUID: {e}"))?;

    // Check active session
    let sess = session.lock().await;
    let _sess = sess
        .as_ref()
        .ok_or_else(|| "Unauthorized: session expired or locked".to_string())?;

    let mut worker_guard = worker.lock().await;
    let model_info = worker_guard.get_model_info();

    {
        let conn = db.lock().await;
        let _ = audit::log::append_event(
            &conn,
            &AuditEvent::AiRunStarted {
                model_id: model_info.id.clone(),
                model_version: model_info.version.clone(),
                input_ref: input_ref.clone(),
            },
        );
    }

    let input = ModelInput {
        synthetic_image_ref: input_ref.clone(),
        metadata: serde_json::json!({ "case_id": case_id }),
    };

    let output = worker_guard.run_inference(input).await?;

    let mut created_results = Vec::new();
    let conn = db.lock().await;

    for raw in output.findings {
        let result = AiResult {
            id: Uuid::new_v4(),
            case_id: cid,
            model_info: model_info.clone(),
            finding: RawFinding {
                label: raw.label,
                confidence: raw.confidence,
            },
            input_ref: input_ref.clone(),
            run_at: Utc::now(),
            doctor_action: None,
            doctor_user_id: None,
            action_at: None,
        };

        store::findings::insert(&conn, &result).map_err(|e| e.to_string())?;

        let _ = audit::log::append_event(
            &conn,
            &AuditEvent::AiRunCompleted {
                model_id: model_info.id.clone(),
                result_id: result.id,
            },
        );

        created_results.push(result);
    }

    Ok(created_results)
}

#[tauri::command]
pub async fn record_doctor_action(
    finding_id: String,
    action: DoctorAction,
    db: State<'_, SharedDb>,
    session: State<'_, SharedSession>,
) -> Result<(), String> {
    let fid = Uuid::parse_str(&finding_id).map_err(|e| format!("Invalid UUID: {e}"))?;

    let sess_guard = session.lock().await;
    let sess = sess_guard
        .as_ref()
        .ok_or_else(|| "Unauthorized: session locked".to_string())?;
    let doc_id = sess.doctor_id;

    let conn = db.lock().await;
    store::findings::record_action(&conn, &fid, &action, &doc_id).map_err(|e| e.to_string())?;

    let action_str = match &action {
        DoctorAction::Accepted => "Accepted".to_string(),
        DoctorAction::Edited { new_text } => format!("Edited: {new_text}"),
        DoctorAction::Rejected => "Rejected".to_string(),
    };

    let _ = audit::log::append_event(
        &conn,
        &AuditEvent::DoctorAction {
            result_id: fid,
            action: action_str,
            doctor_id: doc_id,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn get_audit_log(
    limit: usize,
    offset: usize,
    db: State<'_, SharedDb>,
) -> Result<Vec<AuditEntry>, String> {
    let conn = db.lock().await;
    audit::log::get_entries(&conn, limit, offset).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_audit_chain(db: State<'_, SharedDb>) -> Result<ChainVerifyResponse, String> {
    let conn = db.lock().await;
    match audit::verify::verify_chain(&conn) {
        Ok(()) => {
            let _ = audit::log::append_event(&conn, &AuditEvent::ChainVerified { ok: true });
            Ok(ChainVerifyResponse {
                ok: true,
                message: "Audit chain verified successfully with zero tampering.".into(),
            })
        }
        Err(e) => Ok(ChainVerifyResponse {
            ok: false,
            message: format!("ALERT: Audit chain integrity broken: {e}"),
        }),
    }
}

#[tauri::command]
pub async fn seed_synthetic_data(db: State<'_, SharedDb>) -> Result<String, String> {
    let conn = db.lock().await;
    store::seed::seed_all(&conn).map_err(|e| e.to_string())?;
    Ok("Synthetic demo data seeded successfully".into())
}

#[tauri::command]
pub async fn get_model_info(
    worker: State<'_, SharedWorker>,
) -> Result<doctor_core::types::ModelInfo, String> {
    let worker_guard = worker.lock().await;
    Ok(worker_guard.get_model_info())
}
