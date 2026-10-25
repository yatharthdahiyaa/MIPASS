//! Finding persistence (AI results + doctor actions).
use crate::error::StoreError;
use chrono::{DateTime, Utc};
use doctor_core::types::{AiResult, DoctorAction, ModelInfo, RawFinding};
use rusqlite::{params, Connection};
use uuid::Uuid;

pub fn insert(conn: &Connection, result: &AiResult) -> Result<(), StoreError> {
    let (action_str, actor, action_at) = match &result.doctor_action {
        Some(a) => (
            Some(serde_json::to_string(a)?),
            result.doctor_user_id.map(|u| u.to_string()),
            result.action_at.map(|t| t.to_rfc3339()),
        ),
        None => (None, None, None),
    };
    conn.execute(
        "INSERT INTO findings
         (id, case_id, label, confidence, model_id, model_version, model_sha256,
          input_ref, run_at, doctor_action, doctor_user_id, action_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        params![
            result.id.to_string(),
            result.case_id.to_string(),
            result.finding.label,
            result.finding.confidence,
            result.model_info.id,
            result.model_info.version,
            result.model_info.bundle_sha256,
            result.input_ref,
            result.run_at.to_rfc3339(),
            action_str,
            actor,
            action_at,
        ],
    )?;
    Ok(())
}

/// Record a doctor action on an existing finding.
/// AI output must not update the record without this explicit call.
pub fn record_action(
    conn: &Connection,
    finding_id: &Uuid,
    action: &DoctorAction,
    doctor_id: &Uuid,
) -> Result<(), StoreError> {
    let action_json = serde_json::to_string(action)?;
    let now = Utc::now().to_rfc3339();
    let updated = conn.execute(
        "UPDATE findings SET doctor_action=?1, doctor_user_id=?2, action_at=?3 WHERE id=?4",
        params![
            action_json,
            doctor_id.to_string(),
            now,
            finding_id.to_string()
        ],
    )?;
    if updated == 0 {
        return Err(StoreError::NotFound {
            kind: "finding".into(),
            id: finding_id.to_string(),
        });
    }
    Ok(())
}

pub fn list_for_case(conn: &Connection, case_id: &Uuid) -> Result<Vec<AiResult>, StoreError> {
    let mut stmt = conn.prepare(
        "SELECT id, case_id, label, confidence, model_id, model_version, model_sha256,
                input_ref, run_at, doctor_action, doctor_user_id, action_at
         FROM findings WHERE case_id = ?1 ORDER BY run_at DESC",
    )?;
    let rows: Vec<Result<AiResult, StoreError>> = stmt
        .query_map(params![case_id.to_string()], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, f64>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, String>(7)?,
                r.get::<_, String>(8)?,
                r.get::<_, Option<String>>(9)?,
                r.get::<_, Option<String>>(10)?,
                r.get::<_, Option<String>>(11)?,
            ))
        })?
        .map(|r| parse_finding(r?))
        .collect();
    rows.into_iter().collect()
}

type FindingRow = (
    String,
    String,
    String,
    f64,
    String,
    String,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
);

fn parse_finding(row: FindingRow) -> Result<AiResult, StoreError> {
    let doctor_action = match row.9 {
        Some(j) => Some(serde_json::from_str(&j)?),
        None => None,
    };
    let doctor_user_id = row
        .10
        .map(|s| Uuid::parse_str(&s).map_err(|e| StoreError::InvalidData(e.to_string())))
        .transpose()?;
    let action_at = row
        .11
        .map(|s| {
            DateTime::parse_from_rfc3339(&s)
                .map(|d| d.with_timezone(&Utc))
                .map_err(|e| StoreError::InvalidData(e.to_string()))
        })
        .transpose()?;
    Ok(AiResult {
        id: Uuid::parse_str(&row.0).map_err(|e| StoreError::InvalidData(e.to_string()))?,
        case_id: Uuid::parse_str(&row.1).map_err(|e| StoreError::InvalidData(e.to_string()))?,
        finding: RawFinding {
            label: row.2,
            confidence: row.3 as f32,
        },
        model_info: ModelInfo {
            id: row.4,
            version: row.5,
            bundle_sha256: row.6,
        },
        input_ref: row.7,
        run_at: DateTime::parse_from_rfc3339(&row.8)
            .map(|d| d.with_timezone(&Utc))
            .map_err(|e| StoreError::InvalidData(e.to_string()))?,
        doctor_action,
        doctor_user_id,
        action_at,
    })
}
