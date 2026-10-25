use thiserror::Error;

#[derive(Debug, Error)]
pub enum InferError {
    #[error("model error: {0}")]
    Model(String),
    #[error("cancelled")]
    Cancelled,
    #[error("timeout after {0} ms")]
    Timeout(u64),
    #[error("invalid signed bundle: {0}")]
    InvalidBundle(String),
    #[error("verification signature error: {0}")]
    Signature(String),
    #[error("hash mismatch: expected {expected}, got {got}")]
    HashMismatch { expected: String, got: String },
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("model not loaded: {0}")]
    NotLoaded(String),
    #[error("model already loaded: {0}")]
    AlreadyLoaded(String),
    #[error("memory limit exceeded: {0} MB")]
    MemoryCapExceeded(u64),
}
