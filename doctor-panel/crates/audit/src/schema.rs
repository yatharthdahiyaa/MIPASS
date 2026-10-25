use crate::error::AuditError;
use rusqlite::Connection;

pub const GENESIS_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";

pub fn init_audit_table(conn: &Connection) -> Result<(), AuditError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS audit_log (
            seq       INTEGER PRIMARY KEY AUTOINCREMENT,
            event     TEXT    NOT NULL,
            timestamp TEXT    NOT NULL,
            prev_hash TEXT    NOT NULL,
            hash      TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_seq ON audit_log(seq);",
    )?;
    Ok(())
}
