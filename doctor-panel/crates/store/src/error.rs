use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("keyring error: {0}")]
    Keyring(String),
    #[error("migration error: {0}")]
    Migration(String),
    #[error("not found: {kind} {id}")]
    NotFound { kind: String, id: String },
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("invalid data: {0}")]
    InvalidData(String),
}
