#![forbid(unsafe_code)]

pub mod commands;
pub mod worker_client;

use commands::*;
use std::sync::Arc;
use tokio::sync::Mutex;
use worker_client::WorkerClient;

pub fn run() {
    let _ = env_logger::try_init();

    // Open database
    // For M1 desktop operation, create/open SQLite database with SQLCipher encryption
    let db_path = "mipaas_doctor.db";
    let key = store::key::get_or_create_key().unwrap_or_else(|_| {
        // Fallback for tests/environments without keyring service
        store::key::create_key_from_slice(&[42u8; 32])
    });

    let conn = store::db::open(std::path::Path::new(db_path), &key)
        .unwrap_or_else(|_| store::db::open_in_memory().expect("in-memory db open failed"));

    // Run migrations and init audit table
    if let Err(e) = store::migrations::run(&conn) {
        log::error!("Database migration failed: {e}");
    }
    if let Err(e) = audit::schema::init_audit_table(&conn) {
        log::error!("Audit schema init failed: {e}");
    }

    // Auto-seed synthetic data for M1 development
    let _ = store::seed::seed_all(&conn);

    let shared_db: SharedDb = Arc::new(Mutex::new(conn));
    let shared_session: SharedSession = Arc::new(Mutex::new(None));
    let shared_worker = Arc::new(Mutex::new(WorkerClient::new()));
    let worker_init_ref = Arc::clone(&shared_worker);

    tauri::Builder::default()
        .manage(shared_db)
        .manage(shared_session)
        .manage(shared_worker)
        .setup(move |_app| {
            tauri::async_runtime::spawn(async move {
                let sidecar = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|dir| dir.join("infer-worker.exe")));
                let mut guard = worker_init_ref.lock().await;
                if let Some(path) = sidecar.as_ref().and_then(|p| p.to_str()) {
                    guard.init(Some(path)).await;
                } else {
                    guard.init(None).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login,
            lock_screen,
            get_session,
            get_patients,
            get_patient,
            get_case,
            run_ai,
            record_doctor_action,
            get_audit_log,
            verify_audit_chain,
            seed_synthetic_data,
            get_model_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
