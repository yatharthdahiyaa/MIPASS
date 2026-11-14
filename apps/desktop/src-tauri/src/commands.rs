//! Commands exposed to the webview. Design rules:
//! * The session token lives only in Rust memory; the UI never sees it.
//! * The UI never supplies file-system paths: Rust opens the dialogs and hands
//!   back an opaque id for a picked file.
//! * Every id/enum coming from the UI is validated before it reaches a URL.

use std::path::PathBuf;

use base64::Engine;
use reqwest::{multipart, Method};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::{
    config::normalize_server,
    error::{AppError, AppResult},
    AppState, PickedFile, Session,
};

const MAX_UPLOAD_BYTES: u64 = 25 * 1024 * 1024;
// Union of what the server-side study analysers read; the server decides which analyser applies.
const STUDY_EXTENSIONS: [&str; 6] = ["dcm", "dicom", "png", "jpg", "jpeg", "webp"];

/// Analyser ids are short registry keys such as `chest_xray`.
fn valid_analyzer(id: &str) -> AppResult<&str> {
    if !id.is_empty() && id.len() <= 60 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        Ok(id)
    } else {
        Err(AppError::Invalid("Invalid study type.".into()))
    }
}

pub(crate) fn valid_id(id: &str) -> AppResult<&str> {
    if !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        Ok(id)
    } else {
        Err(AppError::Invalid("Invalid id.".into()))
    }
}

/// Snapshot of what a request needs, taken without holding locks across awaits.
pub(crate) fn auth(state: &State<'_, AppState>) -> AppResult<(url::Url, String)> {
    let server = state.config.read().unwrap().server();
    let token = state
        .session
        .read()
        .unwrap()
        .as_ref()
        .map(|s| s.token.clone())
        .ok_or(AppError::NotSignedIn)?;
    Ok((server, token))
}

/// Drops the local session when the server says it is no longer valid.
pub(crate) fn on_err<T>(state: &State<'_, AppState>, r: AppResult<T>) -> AppResult<T> {
    if matches!(r, Err(AppError::SessionExpired)) {
        *state.session.write().unwrap() = None;
    }
    r
}

// ----------------------------------------------------------------- server

#[derive(Serialize)]
pub struct ServerInfo {
    server_url: String,
    reachable: bool,
    version: Option<String>,
}

#[tauri::command]
pub async fn server_status(state: State<'_, AppState>) -> AppResult<ServerInfo> {
    let server = state.config.read().unwrap().server();
    let version = state.api.health(&server).await;
    Ok(ServerInfo {
        server_url: server.as_str().trim_end_matches('/').to_string(),
        reachable: version.is_some(),
        version,
    })
}

#[tauri::command]
pub async fn set_server_url(state: State<'_, AppState>, url: String) -> AppResult<String> {
    let normalized = normalize_server(&url)?;
    {
        let mut cfg = state.config.write().unwrap();
        if cfg.server() != normalized {
            // Never carry a token over to a different server.
            *state.session.write().unwrap() = None;
        }
        cfg.server_url = normalized.to_string();
        cfg.save(&state.config_path)?;
    }
    Ok(normalized.as_str().trim_end_matches('/').to_string())
}

// ----------------------------------------------------------------- auth

#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    identifier: String,
    password: String,
    mfa_code: Option<String>,
) -> AppResult<Value> {
    let identifier = identifier.trim().to_string();
    if identifier.is_empty() || password.is_empty() {
        return Err(AppError::Invalid("Enter your email and password.".into()));
    }
    let server = state.config.read().unwrap().server();
    let mut body = json!({ "identifier": identifier, "password": password, "client": "desktop" });
    // Two-step verification: the code (authenticator or recovery) rides along with the
    // credentials, so no challenge token ever has to pass through the webview.
    if let Some(code) = mfa_code.as_deref().map(str::trim).filter(|c| !c.is_empty()) {
        body["mfa_code"] = json!(code);
    }
    let data = state
        .api
        .json(&server, None, Method::POST, "auth/login", Some(&body))
        .await?;
    if data.get("mfa_required").and_then(Value::as_bool) == Some(true) {
        return Err(AppError::MfaRequired);
    }
    let token = data
        .get("token")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            AppError::Server(
                "This server doesn't support desktop sign-in. Update the MIPAAS backend.".into(),
            )
        })?
        .to_string();
    let user = data.get("user").cloned().unwrap_or(Value::Null);
    *state.session.write().unwrap() = Some(Session {
        token,
        user: user.clone(),
    });
    Ok(user)
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> AppResult<()> {
    let taken = state.session.write().unwrap().take();
    state.picked.lock().unwrap().clear();
    if let Some(session) = taken {
        let server = state.config.read().unwrap().server();
        // Best effort: revoke server-side; the local copy is already gone.
        let _ = state
            .api
            .json(
                &server,
                Some(&session.token),
                Method::POST,
                "auth/logout",
                None,
            )
            .await;
    }
    Ok(())
}

#[tauri::command]
pub fn current_user(state: State<'_, AppState>) -> Option<Value> {
    state
        .session
        .read()
        .unwrap()
        .as_ref()
        .map(|s| s.user.clone())
}

// ----------------------------------------------------------------- studies

/// Study types the server can analyse and whether each has a trained model installed.
#[tauri::command]
pub async fn list_analyzers(state: State<'_, AppState>) -> AppResult<Value> {
    let (server, token) = auth(&state)?;
    let r = state
        .api
        .json(&server, Some(&token), Method::GET, "doctor/analyzers", None)
        .await;
    on_err(&state, r)
}

/// Re-runs the analysis of one draft study (e.g. after a model was installed or a run failed).
#[tauri::command]
pub async fn analyze_study(state: State<'_, AppState>, id: String) -> AppResult<Value> {
    let (server, token) = auth(&state)?;
    let r = state
        .api
        .json(
            &server,
            Some(&token),
            Method::POST,
            &format!("doctor/studies/{}/analyze", valid_id(&id)?),
            None,
        )
        .await;
    on_err(&state, r)
}

/// Analyses every waiting draft whose model is now installed (runs automatically from the UI).
#[tauri::command]
pub async fn analyze_waiting(state: State<'_, AppState>) -> AppResult<Value> {
    let (server, token) = auth(&state)?;
    let r = state
        .api
        .json(&server, Some(&token), Method::POST, "doctor/studies/analyze", None)
        .await;
    on_err(&state, r)
}

#[tauri::command]
pub async fn summary(state: State<'_, AppState>) -> AppResult<Value> {
    let (server, token) = auth(&state)?;
    let r = state
        .api
        .json(&server, Some(&token), Method::GET, "doctor/summary", None)
        .await;
    on_err(&state, r)
}

#[tauri::command]
pub async fn list_studies(
    state: State<'_, AppState>,
    filter: String,
    query: Option<String>,
) -> AppResult<Value> {
    let filter = match filter.as_str() {
        "all" | "draft" | "signed" | "urgent" | "pending" | "failed" => filter,
        _ => return Err(AppError::Invalid("Unknown filter.".into())),
    };
    let (server, token) = auth(&state)?;
    // Build the query string before awaiting (the serializer isn't Send).
    let qs = {
        let mut ser = url::form_urlencoded::Serializer::new(String::new());
        ser.append_pair("filter", &filter);
        if let Some(q) = query
            .map(|q| q.trim().chars().take(100).collect::<String>())
            .filter(|q| !q.is_empty())
        {
            ser.append_pair("q", &q);
        }
        ser.finish()
    };
    let r = state
        .api
        .json(
            &server,
            Some(&token),
            Method::GET,
            &format!("doctor/studies?{qs}"),
            None,
        )
        .await;
    on_err(&state, r)
}

#[tauri::command]
pub async fn get_study(state: State<'_, AppState>, id: String) -> AppResult<Value> {
    let (server, token) = auth(&state)?;
    let r = state
        .api
        .json(
            &server,
            Some(&token),
            Method::GET,
            &format!("doctor/studies/{}", valid_id(&id)?),
            None,
        )
        .await;
    on_err(&state, r)
}

#[derive(Deserialize)]
pub struct StudyPatch {
    patient_ref: Option<String>,
    patient_name: Option<String>,
    patient_age: Option<String>,
    patient_sex: Option<String>,
    study_date: Option<String>,
    clinical_notes: Option<String>,
    impression: Option<String>,
    /// Care link to share the signed report with; "" unlinks.
    patient_link_id: Option<String>,
}

#[tauri::command]
pub async fn update_study(
    state: State<'_, AppState>,
    id: String,
    patch: StudyPatch,
) -> AppResult<Value> {
    let (server, token) = auth(&state)?;
    // Only whitelisted fields are forwarded.
    let mut body = serde_json::Map::new();
    for (k, v) in [
        ("patient_ref", patch.patient_ref),
        ("patient_name", patch.patient_name),
        ("patient_age", patch.patient_age),
        ("patient_sex", patch.patient_sex),
        ("study_date", patch.study_date),
        ("clinical_notes", patch.clinical_notes),
        ("impression", patch.impression),
    ] {
        if let Some(v) = v {
            body.insert(k.into(), Value::String(v));
        }
    }
    if let Some(link) = patch.patient_link_id {
        let value = if link.is_empty() {
            Value::Null
        } else {
            Value::String(valid_id(&link)?.to_string())
        };
        body.insert("patient_link_id".into(), value);
    }
    let r = state
        .api
        .json(
            &server,
            Some(&token),
            Method::PATCH,
            &format!("doctor/studies/{}", valid_id(&id)?),
            Some(&Value::Object(body)),
        )
        .await;
    on_err(&state, r)
}

#[tauri::command]
pub async fn sign_study(state: State<'_, AppState>, id: String) -> AppResult<Value> {
    let (server, token) = auth(&state)?;
    let r = state
        .api
        .json(
            &server,
            Some(&token),
            Method::POST,
            &format!("doctor/studies/{}/sign", valid_id(&id)?),
            None,
        )
        .await;
    on_err(&state, r)
}

#[tauri::command]
pub async fn delete_study(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let (server, token) = auth(&state)?;
    let r = state
        .api
        .json(
            &server,
            Some(&token),
            Method::DELETE,
            &format!("doctor/studies/{}", valid_id(&id)?),
            None,
        )
        .await;
    on_err(&state, r).map(|_| ())
}

/// Returns the image as a `data:` URL so the webview never needs network access or the token.
#[tauri::command]
pub async fn study_image(
    state: State<'_, AppState>,
    id: String,
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
            &format!("doctor/studies/{}/image?kind={}", valid_id(&id)?, kind),
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

// ----------------------------------------------------------------- files

#[derive(Serialize)]
pub struct PickedInfo {
    id: String,
    name: String,
    size: u64,
}

/// Opens the native file dialog (Rust side) and remembers the chosen path under an opaque id.
#[tauri::command]
pub async fn pick_study_file(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<Option<PickedInfo>> {
    auth(&state)?;
    let picked = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Choose an imaging study")
            .add_filter("Imaging study (DICOM, PNG, JPG, WEBP)", &STUDY_EXTENSIONS)
            .blocking_pick_file()
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let Some(fp) = picked else { return Ok(None) };
    let path: PathBuf = fp
        .into_path()
        .map_err(|_| AppError::Invalid("That file can't be opened.".into()))?;
    let ext_ok = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| STUDY_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false);
    if !ext_ok {
        return Err(AppError::Invalid(
            "Choose a DICOM (.dcm), PNG, JPG or WEBP file.".into(),
        ));
    }
    let meta = std::fs::metadata(&path)?;
    if !meta.is_file() {
        return Err(AppError::Invalid("That isn't a file.".into()));
    }
    if meta.len() == 0 || meta.len() > MAX_UPLOAD_BYTES {
        return Err(AppError::Invalid(
            "Files must be between 1 byte and 25 MB.".into(),
        ));
    }
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("study")
        .to_string();
    let id = uuid::Uuid::new_v4().to_string();
    state.picked.lock().unwrap().insert(
        id.clone(),
        PickedFile {
            path,
            name: name.clone(),
        },
    );
    Ok(Some(PickedInfo {
        id,
        name,
        size: meta.len(),
    }))
}

#[derive(Deserialize)]
pub struct UploadFields {
    patient_ref: Option<String>,
    patient_name: Option<String>,
    patient_age: Option<String>,
    patient_sex: Option<String>,
    study_date: Option<String>,
    clinical_notes: Option<String>,
    /// Optional analyser id; when absent the server picks the first that accepts the file.
    analyzer: Option<String>,
}

#[tauri::command]
pub async fn upload_study(
    state: State<'_, AppState>,
    file_id: String,
    fields: UploadFields,
) -> AppResult<Value> {
    let (server, token) = auth(&state)?;
    let picked = state
        .picked
        .lock()
        .unwrap()
        .remove(&file_id)
        .ok_or_else(|| AppError::Invalid("Choose the file again.".into()))?;
    let bytes = std::fs::read(&picked.path)?;
    if bytes.is_empty() || bytes.len() as u64 > MAX_UPLOAD_BYTES {
        return Err(AppError::Invalid(
            "Files must be between 1 byte and 25 MB.".into(),
        ));
    }

    let analyzer = fields
        .analyzer
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty());
    if let Some(a) = &analyzer {
        valid_analyzer(a)?;
    }

    let mut form =
        multipart::Form::new().part("file", multipart::Part::bytes(bytes).file_name(picked.name));
    for (k, v) in [
        ("patient_ref", fields.patient_ref),
        ("patient_name", fields.patient_name),
        ("patient_age", fields.patient_age),
        ("patient_sex", fields.patient_sex),
        ("study_date", fields.study_date),
        ("clinical_notes", fields.clinical_notes),
        ("analyzer", analyzer),
    ] {
        if let Some(v) = v.map(|v| v.trim().to_string()).filter(|v| !v.is_empty()) {
            form = form.text(k, v);
        }
    }
    let r = state
        .api
        .upload(&server, &token, "doctor/studies", form)
        .await;
    on_err(&state, r)
}

/// Saves a report the UI rendered (HTML) through a native save dialog chosen by the doctor.
#[tauri::command]
pub async fn save_report(
    app: AppHandle,
    state: State<'_, AppState>,
    file_name: String,
    html: String,
) -> AppResult<Option<String>> {
    auth(&state)?;
    if html.len() > 5 * 1024 * 1024 {
        return Err(AppError::Invalid("Report is too large.".into()));
    }
    let safe: String = file_name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .take(80)
        .collect();
    let default_name = format!(
        "{}.html",
        if safe.trim().is_empty() {
            "report"
        } else {
            safe.trim()
        }
    );
    let picked = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Save report")
            .set_file_name(&default_name)
            .add_filter("HTML report", &["html"])
            .blocking_save_file()
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;
    let Some(fp) = picked else { return Ok(None) };
    let mut path: PathBuf = fp
        .into_path()
        .map_err(|_| AppError::Invalid("Can't save there.".into()))?;
    if path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("html"))
        != Some(true)
    {
        path.set_extension("html");
    }
    std::fs::write(&path, html)?;
    Ok(Some(path.display().to_string()))
}
