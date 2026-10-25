use thiserror::Error;

#[derive(Debug, Error)]
pub enum AuditError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("chain tamper detected at sequence {seq}: expected hash {expected}, got {got}")]
    TamperDetected {
        seq: i64,
        expected: String,
        got: String,
    },
    #[error("previous hash mismatch at seq {seq}")]
    PrevHashMismatch { seq: i64 },
    #[error("audit log is empty")]
    Empty,
}
