use serde::{Serialize, Serializer};

/// Errors returned to the UI as `{ code, message }`. Messages are user-facing;
/// internal details (paths, tokens, stack traces) never cross into the webview.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Please sign in.")]
    NotSignedIn,
    #[error("Your session has ended. Please sign in again.")]
    SessionExpired,
    /// The password was accepted but the account has two-step verification on.
    #[error("Enter the 6-digit code from your authenticator app.")]
    MfaRequired,
    #[error(
        "Can't reach the MIPAAS server at {0}. Check that it is running and the address is right."
    )]
    Unreachable(String),
    #[error("{0}")]
    Server(String),
    #[error("{0}")]
    Invalid(String),
    #[error("Something went wrong: {0}")]
    Internal(String),
}

impl AppError {
    fn code(&self) -> &'static str {
        match self {
            AppError::NotSignedIn => "NOT_SIGNED_IN",
            AppError::SessionExpired => "SESSION_EXPIRED",
            AppError::MfaRequired => "MFA_REQUIRED",
            AppError::Unreachable(_) => "UNREACHABLE",
            AppError::Server(_) => "SERVER",
            AppError::Invalid(_) => "INVALID",
            AppError::Internal(_) => "INTERNAL",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Internal(e.kind().to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
