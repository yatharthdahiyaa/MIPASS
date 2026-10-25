//! Doctor account management: Argon2id hashing, verify, and update.
use crate::error::StoreError;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use chrono::{DateTime, Utc};
use doctor_core::types::Doctor;
use rusqlite::{params, Connection};
use uuid::Uuid;

/// Create a new doctor account. Hashes `password` with Argon2id before storage.
pub fn create(conn: &Connection, username: &str, password: &str) -> Result<Doctor, StoreError> {
    let id = Uuid::new_v4();
    let hash = hash_password(password)?;
    let now = Utc::now();
    conn.execute(
        "INSERT INTO doctors (id, username, argon2_hash, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id.to_string(), username, hash, now.to_rfc3339()],
    )?;
    Ok(Doctor {
        id,
        username: username.to_string(),
        created_at: now,
        last_login_at: None,
    })
}

/// Verify a password against the stored Argon2id hash.
pub fn verify(conn: &Connection, username: &str, password: &str) -> Result<Doctor, StoreError> {
    let row: (String, String, String, Option<String>) = conn
        .query_row(
            "SELECT id, argon2_hash, created_at, last_login_at FROM doctors WHERE username = ?1",
            params![username],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => StoreError::NotFound {
                kind: "doctor".into(),
                id: username.to_string(),
            },
            other => StoreError::Db(other),
        })?;

    let parsed = PasswordHash::new(&row.1).map_err(|e| StoreError::InvalidData(e.to_string()))?;

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .map_err(|_| StoreError::InvalidData("invalid credentials".into()))?;

    Ok(Doctor {
        id: Uuid::parse_str(&row.0).map_err(|e| StoreError::InvalidData(e.to_string()))?,
        username: username.to_string(),
        created_at: DateTime::parse_from_rfc3339(&row.2)
            .map(|d| d.with_timezone(&Utc))
            .map_err(|e| StoreError::InvalidData(e.to_string()))?,
        last_login_at: row
            .3
            .map(|s| {
                DateTime::parse_from_rfc3339(&s)
                    .map(|d| d.with_timezone(&Utc))
                    .map_err(|e| StoreError::InvalidData(e.to_string()))
            })
            .transpose()?,
    })
}

/// Update last_login_at to now.
pub fn touch_login(conn: &Connection, id: &Uuid) -> Result<(), StoreError> {
    conn.execute(
        "UPDATE doctors SET last_login_at = ?1 WHERE id = ?2",
        params![Utc::now().to_rfc3339(), id.to_string()],
    )?;
    Ok(())
}

fn hash_password(password: &str) -> Result<String, StoreError> {
    let hash = Argon2::default()
        .hash_password(password.as_bytes())
        .map_err(|e| StoreError::InvalidData(e.to_string()))?
        .to_string();
    Ok(hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_and_verify() {
        let conn = crate::db::open_in_memory().unwrap();
        let doc = create(&conn, "dr_synth", "SecurePass!1").unwrap();
        assert_eq!(doc.username, "dr_synth");

        let verified = verify(&conn, "dr_synth", "SecurePass!1").unwrap();
        assert_eq!(verified.id, doc.id);
    }

    #[test]
    fn wrong_password_rejected() {
        let conn = crate::db::open_in_memory().unwrap();
        create(&conn, "dr_synth2", "RealPass!99").unwrap();
        let result = verify(&conn, "dr_synth2", "WrongPass!00");
        assert!(matches!(result, Err(StoreError::InvalidData(_))));
    }

    #[test]
    fn unknown_user_rejected() {
        let conn = crate::db::open_in_memory().unwrap();
        let result = verify(&conn, "nobody", "anything");
        assert!(matches!(result, Err(StoreError::NotFound { .. })));
    }
}
