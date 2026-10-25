//! Case CRUD.
use crate::error::StoreError;
use chrono::Utc;
use doctor_core::types::Case;
use rusqlite::{params, Connection};
use uuid::Uuid;

pub fn insert(conn: &Connection, case: &Case) -> Result<(), StoreError> {
    conn.execute(
        "INSERT INTO cases (id, patient_id, notes, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![
            case.id.to_string(),
            case.patient_id.to_string(),
            case.notes,
            case.created_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

pub fn list_for_patient(conn: &Connection, patient_id: &Uuid) -> Result<Vec<Case>, StoreError> {
    let mut stmt = conn.prepare(
        "SELECT id, patient_id, notes, created_at FROM cases WHERE patient_id = ?1 ORDER BY created_at DESC"
    )?;
    let rows: Vec<_> = stmt
        .query_map(params![patient_id.to_string()], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();
    rows.into_iter().map(parse_case).collect()
}

pub fn get(conn: &Connection, id: &Uuid) -> Result<Case, StoreError> {
    conn.query_row(
        "SELECT id, patient_id, notes, created_at FROM cases WHERE id = ?1",
        params![id.to_string()],
        |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => StoreError::NotFound {
            kind: "case".into(),
            id: id.to_string(),
        },
        other => StoreError::Db(other),
    })
    .and_then(parse_case)
}

fn parse_case(row: (String, String, String, String)) -> Result<Case, StoreError> {
    use chrono::DateTime;
    Ok(Case {
        id: Uuid::parse_str(&row.0).map_err(|e| StoreError::InvalidData(e.to_string()))?,
        patient_id: Uuid::parse_str(&row.1).map_err(|e| StoreError::InvalidData(e.to_string()))?,
        notes: row.2,
        created_at: DateTime::parse_from_rfc3339(&row.3)
            .map(|d| d.with_timezone(&Utc))
            .map_err(|e| StoreError::InvalidData(e.to_string()))?,
    })
}
