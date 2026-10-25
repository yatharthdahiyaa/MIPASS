//! Audit events. Strictly NO PHI. Use identifiers only.
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "payload")]
pub enum AuditEvent {
    Login {
        doctor_id: Uuid,
        success: bool,
    },
    RecordViewed {
        entity_type: String,
        entity_id: Uuid,
    },
    AiRunStarted {
        model_id: String,
        model_version: String,
        input_ref: String,
    },
    AiRunCompleted {
        model_id: String,
        result_id: Uuid,
    },
    DoctorAction {
        result_id: Uuid,
        action: String,
        doctor_id: Uuid,
    },
    Export {
        export_ref: String,
    },
    ChainVerified {
        ok: bool,
    },
    AutoLock {
        doctor_id: Uuid,
    },
}
