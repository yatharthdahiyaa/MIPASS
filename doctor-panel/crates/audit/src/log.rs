//! Append-only audit logger with SHA-256 hash chaining.
use crate::error::AuditError;
use crate::events::AuditEvent;
use crate::schema::GENESIS_HASH;
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub seq: i64,
    pub event: String,
    pub timestamp: String,
    pub prev_hash: String,
    pub hash: String,
}

/// Compute SHA-256 hash for a given audit row.
pub fn compute_hash(seq: i64, event_json: &str, timestamp: &str, prev_hash: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(seq.to_string().as_bytes());
    hasher.update(b"|");
    hasher.update(event_json.as_bytes());
    hasher.update(b"|");
    hasher.update(timestamp.as_bytes());
    hasher.update(b"|");
    hasher.update(prev_hash.as_bytes());
    hex::encode(hasher.finalize())
}

/// Appends a new event to the audit log, chaining from the previous record.
pub fn append_event(conn: &Connection, event: &AuditEvent) -> Result<i64, AuditError> {
    let event_json = serde_json::to_string(event)?;
    let timestamp = Utc::now().to_rfc3339();

    // Fetch the last record
    let last = conn
        .query_row(
            "SELECT seq, hash FROM audit_log ORDER BY seq DESC LIMIT 1",
            [],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()?;

    let (next_seq, prev_hash) = match last {
        Some((seq, hash)) => (seq + 1, hash),
        None => (1, GENESIS_HASH.to_string()),
    };

    let current_hash = compute_hash(next_seq, &event_json, &timestamp, &prev_hash);

    conn.execute(
        "INSERT INTO audit_log (seq, event, timestamp, prev_hash, hash)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![next_seq, event_json, timestamp, prev_hash, current_hash],
    )?;

    Ok(next_seq)
}

/// Query paginated audit log entries ordered by seq ascending.
pub fn get_entries(
    conn: &Connection,
    limit: usize,
    offset: usize,
) -> Result<Vec<AuditEntry>, AuditError> {
    let mut stmt = conn.prepare(
        "SELECT seq, event, timestamp, prev_hash, hash
         FROM audit_log
         ORDER BY seq ASC
         LIMIT ?1 OFFSET ?2",
    )?;

    let rows = stmt.query_map(params![limit as i64, offset as i64], |row| {
        Ok(AuditEntry {
            seq: row.get(0)?,
            event: row.get(1)?,
            timestamp: row.get(2)?,
            prev_hash: row.get(3)?,
            hash: row.get(4)?,
        })
    })?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }
    Ok(entries)
}
