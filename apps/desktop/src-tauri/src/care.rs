//! Commands for the doctor's side of care connections: patients who share their record,
//! secure messages, consultations and notifications.
//!
//! Same rules as `commands.rs`: the token never leaves Rust, every id and enum from the UI
//! is validated before it is put in a URL, and files are written only through native dialogs.

use std::path::PathBuf;

use base64::Engine;
use reqwest::Method;
use serde_json::{json, Value};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::{
    commands::{auth, on_err, valid_id},
    error::{AppError, AppResult},
    AppState,
};

/// One authenticated JSON call; drops the local session if the server no longer accepts it.
async fn call(
    state: &State<'_, AppState>,
    method: Method,
    path: &str,
    body: Option<&Value>,
) -> AppResult<Value> {
    let (server, token) = auth(state)?;
    let r = state
        .api
        .json(&server, Some(&token), method, path, body)
        .await;
    on_err(state, r)
}

/// Trims free text and caps its length (the server validates again).
fn text(value: &str, max_chars: usize) -> String {
    value.trim().chars().take(max_chars).collect()
}

fn optional_text(value: Option<String>, max_chars: usize) -> Option<String> {
    value.map(|v| text(&v, max_chars)).filter(|v| !v.is_empty())
}

// ----------------------------------------------------------------- overview

/// Pending invitations, consultation requests and unread counts for the home screen.
#[tauri::command]
pub async fn dashboard(state: State<'_, AppState>) -> AppResult<Value> {
    call(&state, Method::GET, "doctor/dashboard", None).await
}

/// The signed-in doctor's profile, including the share code patients use to connect.
#[tauri::command]
pub async fn doctor_profile(state: State<'_, AppState>) -> AppResult<Value> {
    call(&state, Method::GET, "doctor/profile", None).await
}

// ----------------------------------------------------------------- patients

#[tauri::command]
pub async fn list_patients(state: State<'_, AppState>, status: String) -> AppResult<Value> {
    let status = match status.as_str() {
        "active" | "pending" | "ended" | "all" => status,
        _ => return Err(AppError::Invalid("Unknown patient filter.".into())),
    };
    call(
        &state,
        Method::GET,
        &format!("doctor/patients?status={status}"),
        None,
    )
    .await
}

#[tauri::command]
pub async fn invite_patient(
    state: State<'_, AppState>,
    email: String,
    message: Option<String>,
) -> AppResult<Value> {
    let email = text(&email, 255);
    if !email.contains('@') {
        return Err(AppError::Invalid(
            "Enter the patient's e-mail address.".into(),
        ));
    }
    let body = json!({ "email": email, "message": optional_text(message, 500) });
    call(&state, Method::POST, "doctor/patients/invite", Some(&body)).await
}

#[tauri::command]
pub async fn respond_patient(
    state: State<'_, AppState>,
    link_id: String,
    accept: bool,
) -> AppResult<Value> {
    call(
        &state,
        Method::POST,
        &format!("doctor/patients/{}/respond", valid_id(&link_id)?),
        Some(&json!({ "accept": accept })),
    )
    .await
}

#[tauri::command]
pub async fn end_patient_link(state: State<'_, AppState>, link_id: String) -> AppResult<Value> {
    call(
        &state,
        Method::DELETE,
        &format!("doctor/patients/{}", valid_id(&link_id)?),
        None,
    )
    .await
}

/// The parts of the record the patient shared with this doctor.
#[tauri::command]
pub async fn patient_record(
    state: State<'_, AppState>,
    link_id: String,
    days: Option<u32>,
) -> AppResult<Value> {
    let days = days.unwrap_or(30).clamp(7, 366);
    call(
        &state,
        Method::GET,
        &format!(
            "doctor/patients/{}/record?days={days}",
            valid_id(&link_id)?
        ),
        None,
    )
    .await
}

/// A patient's X-ray preview or attention map as a `data:` URL.
#[tauri::command]
pub async fn patient_xray_image(
    state: State<'_, AppState>,
    link_id: String,
    xray_id: String,
    kind: String,
) -> AppResult<String> {
    let kind = match kind.as_str() {
        "preview" | "heatmap" => kind,
        _ => return Err(AppError::Invalid("Unknown image kind.".into())),
    };
    let (server, token) = auth(&state)?;
    let r = state
        .api
        .bytes(
            &server,
            &token,
            &format!(
                "doctor/patients/{}/xrays/{}/image?kind={}",
                valid_id(&link_id)?,
                valid_id(&xray_id)?,
                kind
            ),
        )
        .await;
    let (ctype, bytes) = on_err(&state, r)?;
    if ctype != "image/png" {
        return Err(AppError::Server(
            "Unexpected image format from server.".into(),
        ));
    }
    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[tauri::command]
pub async fn review_xray(
    state: State<'_, AppState>,
    link_id: String,
    xray_id: String,
    impression: String,
    recommendation: Option<String>,
    urgency: String,
) -> AppResult<Value> {
    let urgency = match urgency.as_str() {
        "routine" | "soon" | "urgent" => urgency,
        _ => return Err(AppError::Invalid("Unknown urgency.".into())),
    };
    let impression = text(&impression, 8000);
    if impression.chars().count() < 3 {
        return Err(AppError::Invalid("Write your impression.".into()));
    }
    let body = json!({
        "impression": impression,
        "recommendation": optional_text(recommendation, 4000),
        "urgency": urgency,
    });
    call(
        &state,
        Method::POST,
        &format!(
            "doctor/patients/{}/xrays/{}/review",
            valid_id(&link_id)?,
            valid_id(&xray_id)?
        ),
        Some(&body),
    )
    .await
}

/// Downloads a document the patient shared and saves it where the doctor chooses.
/// Returns the saved path, or `None` if the dialog was cancelled.
#[tauri::command]
pub async fn save_patient_document(
    app: AppHandle,
    state: State<'_, AppState>,
    link_id: String,
    doc_id: String,
    file_name: String,
) -> AppResult<Option<String>> {
    let (server, token) = auth(&state)?;
    let path = format!(
        "doctor/patients/{}/documents/{}/file?download=1",
        valid_id(&link_id)?,
        valid_id(&doc_id)?
    );

    // The name comes from the patient's upload: keep only a plain file name.
    let safe: String = file_name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '-' | '_' | ' ' | '.') {
                c
            } else {
                '_'
            }
        })
        .take(120)
        .collect();
    let safe = safe.trim().trim_start_matches('.').to_string();
    let default_name = if safe.is_empty() {
        "document".to_string()
    } else {
        safe
    };

    let picked = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Save patient document")
            .set_file_name(&default_name)
            .blocking_save_file()
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;
    let Some(fp) = picked else { return Ok(None) };
    let target: PathBuf = fp
        .into_path()
        .map_err(|_| AppError::Invalid("Can't save there.".into()))?;

    let r = state.api.bytes(&server, &token, &path).await;
    let (_, bytes) = on_err(&state, r)?;
    std::fs::write(&target, bytes)?;
    Ok(Some(target.display().to_string()))
}

// ----------------------------------------------------------------- consultations

#[tauri::command]
pub async fn list_consults(
    state: State<'_, AppState>,
    status: Option<String>,
) -> AppResult<Value> {
    let path = match status.as_deref() {
        None | Some("") | Some("all") => "doctor/consults".to_string(),
        Some("upcoming") => "doctor/consults?upcoming=1".to_string(),
        Some(s @ ("requested" | "scheduled" | "declined" | "completed" | "cancelled")) => {
            format!("doctor/consults?status={s}")
        }
        Some(_) => return Err(AppError::Invalid("Unknown consultation filter.".into())),
    };
    call(&state, Method::GET, &path, None).await
}

#[tauri::command]
pub async fn respond_consult(
    state: State<'_, AppState>,
    id: String,
    action: String,
    scheduled_at: Option<String>,
    note: Option<String>,
) -> AppResult<Value> {
    let action = match action.as_str() {
        "schedule" | "decline" | "complete" => action,
        _ => return Err(AppError::Invalid("Unknown action.".into())),
    };
    let body = json!({
        "action": action,
        "scheduled_at": optional_text(scheduled_at, 40),
        "note": optional_text(note, 2000),
    });
    call(
        &state,
        Method::POST,
        &format!("doctor/consults/{}/respond", valid_id(&id)?),
        Some(&body),
    )
    .await
}

// ----------------------------------------------------------------- messages

#[tauri::command]
pub async fn care_threads(state: State<'_, AppState>) -> AppResult<Value> {
    call(&state, Method::GET, "care/threads", None).await
}

#[tauri::command]
pub async fn care_messages(
    state: State<'_, AppState>,
    link_id: String,
    after: Option<String>,
) -> AppResult<Value> {
    let mut path = format!("care/{}/messages", valid_id(&link_id)?);
    if let Some(after) = after.as_deref().filter(|a| !a.is_empty()) {
        path.push_str(&format!("?after={}", valid_id(after)?));
    }
    call(&state, Method::GET, &path, None).await
}

#[tauri::command]
pub async fn send_care_message(
    state: State<'_, AppState>,
    link_id: String,
    body: String,
) -> AppResult<Value> {
    let body = text(&body, 4000);
    if body.is_empty() {
        return Err(AppError::Invalid("Type a message.".into()));
    }
    call(
        &state,
        Method::POST,
        &format!("care/{}/messages", valid_id(&link_id)?),
        Some(&json!({ "body": body })),
    )
    .await
}

#[tauri::command]
pub async fn mark_thread_read(state: State<'_, AppState>, link_id: String) -> AppResult<Value> {
    call(
        &state,
        Method::POST,
        &format!("care/{}/messages/read", valid_id(&link_id)?),
        None,
    )
    .await
}

// ----------------------------------------------------------------- AI agents

/// Starts an AI agent run on the backend; the UI polls `agent_run` until it has finished.
/// Only the doctor-side agents, with their ids checked here before they reach a URL.
#[tauri::command]
pub async fn run_agent(state: State<'_, AppState>, key: String, params: Value) -> AppResult<Value> {
    let id = |name: &str| -> AppResult<Option<String>> {
        match params.get(name).and_then(Value::as_str) {
            Some(v) if !v.is_empty() => Ok(Some(valid_id(v)?.to_string())),
            _ => Ok(None),
        }
    };
    let clean = match key.as_str() {
        "consult_brief" => {
            let link_id = id("link_id")?.ok_or_else(|| AppError::Invalid("Choose a patient.".into()))?;
            let mut p = json!({ "link_id": link_id });
            if let Some(consult_id) = id("consult_id")? {
                p["consult_id"] = json!(consult_id);
            }
            p
        }
        "report_draft" => {
            let study_id = id("study_id")?.ok_or_else(|| AppError::Invalid("Choose a study.".into()))?;
            json!({ "study_id": study_id })
        }
        _ => return Err(AppError::Invalid("Unknown agent.".into())),
    };
    call(
        &state,
        Method::POST,
        &format!("agents/{key}/runs"),
        Some(&json!({ "params": clean })),
    )
    .await
}

#[tauri::command]
pub async fn agent_run(state: State<'_, AppState>, id: String) -> AppResult<Value> {
    call(&state, Method::GET, &format!("agents/runs/{}", valid_id(&id)?), None).await
}

/// Records what the doctor did with a result: accepted, edited (with the text they kept) or discarded.
#[tauri::command]
pub async fn review_agent_run(
    state: State<'_, AppState>,
    id: String,
    decision: String,
    final_text: Option<String>,
) -> AppResult<Value> {
    let decision = match decision.as_str() {
        "accepted" | "edited" | "discarded" => decision,
        _ => return Err(AppError::Invalid("Unknown decision.".into())),
    };
    call(
        &state,
        Method::POST,
        &format!("agents/runs/{}/review", valid_id(&id)?),
        Some(&json!({ "decision": decision, "final_text": optional_text(final_text, 8000) })),
    )
    .await
}

// ----------------------------------------------------------------- notifications

#[tauri::command]
pub async fn notifications(state: State<'_, AppState>) -> AppResult<Value> {
    call(&state, Method::GET, "notifications?limit=50", None).await
}

/// Unread notification and message counts (cheap; polled by the UI).
#[tauri::command]
pub async fn notification_badge(state: State<'_, AppState>) -> AppResult<Value> {
    call(&state, Method::GET, "notifications/badge", None).await
}

/// Marks one notification read, or all of them when `id` is absent.
#[tauri::command]
pub async fn mark_notifications_read(
    state: State<'_, AppState>,
    id: Option<String>,
) -> AppResult<Value> {
    let path = match id.as_deref().filter(|i| !i.is_empty()) {
        Some(id) => format!("notifications/{}/read", valid_id(id)?),
        None => "notifications/read-all".to_string(),
    };
    call(&state, Method::POST, &path, None).await
}
