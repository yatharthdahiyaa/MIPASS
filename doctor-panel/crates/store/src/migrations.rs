//! Schema migrations — table-driven, append-only version list.
use crate::error::StoreError;
use rusqlite::Connection;

struct Migration {
    version: u32,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    sql: "
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER NOT NULL
            );
            INSERT INTO schema_version (version) VALUES (0);

            CREATE TABLE IF NOT EXISTS doctors (
                id          TEXT PRIMARY KEY NOT NULL,
                username    TEXT UNIQUE NOT NULL,
                argon2_hash TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                last_login_at TEXT
            );

            CREATE TABLE IF NOT EXISTS patients (
                id         TEXT PRIMARY KEY NOT NULL,
                name       TEXT NOT NULL,
                dob        TEXT NOT NULL,
                sex        TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);

            CREATE TABLE IF NOT EXISTS cases (
                id         TEXT PRIMARY KEY NOT NULL,
                patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                notes      TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_cases_patient ON cases(patient_id);

            CREATE TABLE IF NOT EXISTS findings (
                id              TEXT PRIMARY KEY NOT NULL,
                case_id         TEXT REFERENCES cases(id) ON DELETE SET NULL,
                label           TEXT NOT NULL,
                confidence      REAL NOT NULL,
                model_id        TEXT NOT NULL,
                model_version   TEXT NOT NULL,
                model_sha256    TEXT NOT NULL,
                input_ref       TEXT NOT NULL,
                run_at          TEXT NOT NULL,
                doctor_action   TEXT,
                doctor_user_id  TEXT,
                action_at       TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_findings_case ON findings(case_id);

            UPDATE schema_version SET version = 1;
        ",
}];

/// Run any migrations that have not yet been applied.
pub fn run(conn: &Connection) -> Result<(), StoreError> {
    // Ensure the version table exists (first run, before migration 1 creates it)
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_version'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|n| n > 0)?;

    let current_version: u32 = if table_exists {
        conn.query_row("SELECT version FROM schema_version", [], |r| r.get(0))
            .unwrap_or(0)
    } else {
        0
    };

    for m in MIGRATIONS.iter().filter(|m| m.version > current_version) {
        log::info!("store::migrations: applying migration {}", m.version);
        conn.execute_batch(m.sql)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_creates_tables() {
        let conn = crate::db::open_in_memory().unwrap();
        // Verify key tables exist
        let tables: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .unwrap();
            stmt.query_map([], |r| r.get(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        };
        assert!(tables.contains(&"patients".to_string()));
        assert!(tables.contains(&"cases".to_string()));
        assert!(tables.contains(&"findings".to_string()));
        assert!(tables.contains(&"doctors".to_string()));
    }

    #[test]
    fn migration_idempotent() {
        let conn = crate::db::open_in_memory().unwrap();
        // Running again must not error
        run(&conn).unwrap();
    }
}
