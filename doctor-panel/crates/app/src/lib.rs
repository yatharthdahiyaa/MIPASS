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

    tauri::Builder::default()
        .manage(shared_db)
        .manage(shared_session)
        .manage(shared_worker)
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
