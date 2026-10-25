//! Domain types. No I/O. Every type is Clone + Serialize + Deserialize.
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ─── Patient ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Sex {
    Male,
    Female,
    Other,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patient {
    pub id: Uuid,
    /// Display name – never appears in logs or file names
    pub name: String,
    pub dob: NaiveDate,
    pub sex: Sex,
    pub created_at: DateTime<Utc>,
}

// ─── Case ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Case {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub notes: String,
    pub created_at: DateTime<Utc>,
}

// ─── Model metadata ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelInfo {
    /// Short identifier, e.g. "mock-cxr"
    pub id: String,
    pub version: String,
    /// SHA-256 hex of the signed bundle file
    pub bundle_sha256: String,
}

// ─── AI result ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RawFinding {
    /// UI always renders as "AI suggests: <label>" – never "diagnosis is"
    pub label: String,
    /// 0.0–1.0
    pub confidence: f32,
}

impl RawFinding {
    /// Confidence as integer percent, clamped to 0–100.
    pub fn confidence_pct(&self) -> u8 {
        (self.confidence.clamp(0.0, 1.0) * 100.0) as u8
    }
}

// ─── Doctor action ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DoctorAction {
    Accepted,
    Edited { new_text: String },
    Rejected,
}

// ─── Recorded AI result (stored) ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiResult {
    pub id: Uuid,
    pub case_id: Uuid,
    pub model_info: ModelInfo,
    pub finding: RawFinding,
    /// Input reference (NOT the image bytes – a stable content ref)
    pub input_ref: String,
    pub run_at: DateTime<Utc>,
    /// None until doctor acts; never written to final record without explicit action
    pub doctor_action: Option<DoctorAction>,
    pub doctor_user_id: Option<Uuid>,
    pub action_at: Option<DateTime<Utc>>,
}

// ─── Doctor account ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Doctor {
    pub id: Uuid,
    pub username: String,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

// ─── Session ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct Session {
    pub doctor_id: Uuid,
    pub doctor_username: String,
    pub expires_at: DateTime<Utc>,
}

impl Session {
    pub fn is_expired(&self) -> bool {
        Utc::now() >= self.expires_at
    }
}

// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn raw_finding_confidence_pct_clamps() {
        let f = RawFinding {
            label: "test".into(),
            confidence: 0.876,
        };
        assert_eq!(f.confidence_pct(), 87);
        let over = RawFinding {
            label: "t".into(),
            confidence: 1.5,
        };
        assert_eq!(over.confidence_pct(), 100);
    }

    #[test]
    fn doctor_action_serde_round_trip() {
        let a = DoctorAction::Edited {
            new_text: "corrected text".into(),
        };
        let json = serde_json::to_string(&a).unwrap();
        let back: DoctorAction = serde_json::from_str(&json).unwrap();
        assert_eq!(a, back);
    }

    #[test]
    fn patient_serde_round_trip() {
        let p = Patient {
            id: Uuid::new_v4(),
            name: "Synth-Alpha".into(),
            dob: NaiveDate::from_ymd_opt(1980, 6, 15).unwrap(),
            sex: Sex::Male,
            created_at: Utc::now(),
        };
        let json = serde_json::to_string(&p).unwrap();
        let back: Patient = serde_json::from_str(&json).unwrap();
        assert_eq!(p.id, back.id);
    }

    #[test]
    fn session_expiry() {
        use chrono::Duration;
        let session = Session {
            doctor_id: Uuid::new_v4(),
            doctor_username: "dr_test".into(),
            expires_at: Utc::now() - Duration::seconds(1),
        };
        assert!(session.is_expired());

        let session_fresh = Session {
            doctor_id: Uuid::new_v4(),
            doctor_username: "dr_test".into(),
            expires_at: Utc::now() + Duration::minutes(10),
        };
        assert!(!session_fresh.is_expired());
    }
}
