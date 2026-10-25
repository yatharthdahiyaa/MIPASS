//! Patient CRUD operations.
use crate::error::StoreError;
use chrono::Utc;
use doctor_core::types::{Patient, Sex};
use rusqlite::{params, Connection};
use uuid::Uuid;

pub fn insert(conn: &Connection, patient: &Patient) -> Result<(), StoreError> {
    conn.execute(
        "INSERT INTO patients (id, name, dob, sex, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            patient.id.to_string(),
            patient.name,
            patient.dob.to_string(),
            sex_to_str(&patient.sex),
            patient.created_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

pub fn get(conn: &Connection, id: &Uuid) -> Result<Patient, StoreError> {
    let row = conn
        .query_row(
            "SELECT id, name, dob, sex, created_at FROM patients WHERE id = ?1",
            params![id.to_string()],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                ))
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => StoreError::NotFound {
                kind: "patient".into(),
                id: id.to_string(),
            },
            other => StoreError::Db(other),
        })?;
    parse_patient(row)
}

/// Search patients by name (case-insensitive LIKE) with optional sort.
pub fn list(
    conn: &Connection,
    name_filter: Option<&str>,
    sort_by: PatientSort,
) -> Result<Vec<Patient>, StoreError> {
    let order = match sort_by {
        PatientSort::Name => "name ASC",
        PatientSort::Dob => "dob ASC",
        PatientSort::Created => "created_at DESC",
    };
    match name_filter {
        Some(f) => {
            let pattern = format!("%{f}%");
            let mut stmt = conn.prepare(&format!(
                "SELECT id, name, dob, sex, created_at FROM patients WHERE name LIKE ?1 ORDER BY {order}"
            ))?;
            let rows: Vec<_> = stmt
                .query_map(params![pattern], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, String>(4)?,
                    ))
                })?
                .filter_map(|r| r.ok())
                .collect();
            rows.into_iter().map(parse_patient).collect()
        }
        None => {
            let mut stmt = conn.prepare(&format!(
                "SELECT id, name, dob, sex, created_at FROM patients ORDER BY {order}"
            ))?;
            let rows: Vec<_> = stmt
                .query_map([], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, String>(4)?,
                    ))
                })?
                .filter_map(|r| r.ok())
                .collect();
            rows.into_iter().map(parse_patient).collect()
        }
    }
}

pub enum PatientSort {
    Name,
    Dob,
    Created,
}

fn parse_patient(row: (String, String, String, String, String)) -> Result<Patient, StoreError> {
    use chrono::DateTime;
    Ok(Patient {
        id: Uuid::parse_str(&row.0).map_err(|e| StoreError::InvalidData(e.to_string()))?,
        name: row.1,
        dob: row
            .2
            .parse()
            .map_err(|e: chrono::ParseError| StoreError::InvalidData(e.to_string()))?,
        sex: str_to_sex(&row.3),
        created_at: DateTime::parse_from_rfc3339(&row.4)
            .map(|d| d.with_timezone(&Utc))
            .map_err(|e| StoreError::InvalidData(e.to_string()))?,
    })
}

fn sex_to_str(s: &Sex) -> &'static str {
    match s {
        Sex::Male => "male",
        Sex::Female => "female",
        Sex::Other => "other",
        Sex::Unknown => "unknown",
    }
}

fn str_to_sex(s: &str) -> Sex {
    match s {
        "male" => Sex::Male,
        "female" => Sex::Female,
        "other" => Sex::Other,
        _ => Sex::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_patient(name: &str) -> Patient {
        Patient {
            id: Uuid::new_v4(),
            name: name.into(),
            dob: chrono::NaiveDate::from_ymd_opt(1990, 1, 1).unwrap(),
            sex: Sex::Unknown,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn insert_and_get() {
        let conn = crate::db::open_in_memory().unwrap();
        let p = make_patient("Synth-Alpha");
        insert(&conn, &p).unwrap();
        let back = get(&conn, &p.id).unwrap();
        assert_eq!(p.id, back.id);
        assert_eq!(p.name, back.name);
    }

    #[test]
    fn list_all_and_filter() {
        let conn = crate::db::open_in_memory().unwrap();
        insert(&conn, &make_patient("Synth-Alpha")).unwrap();
        insert(&conn, &make_patient("Synth-Beta")).unwrap();
        let all = list(&conn, None, PatientSort::Name).unwrap();
        assert_eq!(all.len(), 2);
        let filtered = list(&conn, Some("Alpha"), PatientSort::Name).unwrap();
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "Synth-Alpha");
    }

    #[test]
    fn get_not_found() {
        let conn = crate::db::open_in_memory().unwrap();
        let result = get(&conn, &Uuid::new_v4());
        assert!(matches!(result, Err(StoreError::NotFound { .. })));
    }
}
