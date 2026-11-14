//! MIPAAS doctor diagnostic panel (Tauri 2).
//!
//! The Rust process owns the network connection to the MIPAAS backend and the
//! clinician's session; the webview only renders and calls the commands below.

mod api;
mod care;
mod commands;
mod config;
#[cfg(test)]
mod e2e;
mod error;

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Mutex, RwLock},
};

use serde_json::Value;
use tauri::Manager;

pub struct Session {
    pub token: String,
    pub user: Value,
}

pub struct PickedFile {
    pub path: PathBuf,
    pub name: String,
}

pub struct AppState {
    pub api: api::Api,
    pub config: RwLock<config::Config>,
    pub config_path: PathBuf,
    /// Held in memory only: closing the app signs the doctor out locally.
    pub session: RwLock<Option<Session>>,
    pub picked: Mutex<HashMap<String, PickedFile>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let config_path = app.path().app_config_dir()?.join("config.json");
            let config = config::Config::load(&config_path);
            app.manage(AppState {
                api: api::Api::new().map_err(|e| e.to_string())?,
                config: RwLock::new(config),
                config_path,
                session: RwLock::new(None),
                picked: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::server_status,
            commands::set_server_url,
            commands::login,
            commands::logout,
            commands::current_user,
            commands::list_analyzers,
            commands::analyze_study,
            commands::analyze_waiting,
            commands::summary,
            commands::list_studies,
            commands::get_study,
            commands::update_study,
            commands::sign_study,
            commands::delete_study,
            commands::study_image,
            commands::pick_study_file,
            commands::upload_study,
            commands::save_report,
            care::dashboard,
            care::doctor_profile,
            care::list_patients,
            care::invite_patient,
            care::respond_patient,
            care::end_patient_link,
            care::patient_record,
            care::patient_xray_image,
            care::review_xray,
            care::save_patient_document,
            care::list_consults,
            care::respond_consult,
            care::care_threads,
            care::care_messages,
            care::send_care_message,
            care::mark_thread_read,
            care::notifications,
            care::notification_badge,
            care::mark_notifications_read,
            care::run_agent,
            care::agent_run,
            care::review_agent_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the MIPAAS diagnostic panel");
}
