//! Synthetic data seed — dev/demo only. NEVER real patient data.
//! Creates 5 synthetic patients with 2 cases each.
use crate::{cases, doctors, error::StoreError, patients};
use chrono::{NaiveDate, Utc};
use doctor_core::types::{Case, Patient, Sex};
use rusqlite::Connection;
use uuid::Uuid;

pub fn seed_all(conn: &Connection) -> Result<(), StoreError> {
    // Create demo doctor if not exists
    if doctors::verify(conn, "dr_demo", "Demo@1234").is_err() {
        doctors::create(conn, "dr_demo", "Demo@1234")?;
        log::info!("seed: created demo doctor 'dr_demo'");
    }

    let synthetic: &[(&str, &str, Sex)] = &[
        ("Synth-Alpha", "1978-03-22", Sex::Male),
        ("Synth-Beta", "1955-11-08", Sex::Female),
        ("Synth-Gamma", "2001-07-14", Sex::Male),
        ("Synth-Delta", "1969-02-28", Sex::Female),
        ("Synth-Epsilon", "1990-09-05", Sex::Unknown),
    ];

    for (name, dob_str, sex) in synthetic {
        let dob = NaiveDate::parse_from_str(dob_str, "%Y-%m-%d")
            .map_err(|e| StoreError::InvalidData(e.to_string()))?;
        let patient = Patient {
            id: Uuid::new_v4(),
            name: name.to_string(),
            dob,
            sex: sex.clone(),
            created_at: Utc::now(),
        };
        // Ignore duplicate errors (idempotent seed)
        let _ = patients::insert(conn, &patient);

        // Check by listing to get the inserted id
        let existing = patients::list(conn, Some(name), crate::patients::PatientSort::Name)?;
        let pid = match existing.first() {
            Some(p) => p.id,
            None => continue,
        };

        let cases_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM cases WHERE patient_id = ?1",
            rusqlite::params![pid.to_string()],
            |r| r.get(0),
        )?;
        if cases_count == 0 {
            for i in 0..2u32 {
                let case = Case {
                    id: Uuid::new_v4(),
                    patient_id: pid,
                    notes: format!("Synthetic case {} for demo", i + 1),
                    created_at: Utc::now(),
                };
                cases::insert(conn, &case)?;
            }
        }
    }
    log::info!("seed: synthetic data seeded successfully");
    Ok(())
}
