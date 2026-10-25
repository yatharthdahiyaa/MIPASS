use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("invalid confidence value {0}: must be 0.0-1.0")]
    InvalidConfidence(f32),
}
