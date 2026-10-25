//! Audit chain verification and tamper detection.
use crate::error::AuditError;
use crate::log::compute_hash;
use crate::schema::GENESIS_HASH;
use rusqlite::Connection;

/// Verifies the complete integrity of the audit log chain from sequence 1 onwards.
pub fn verify_chain(conn: &Connection) -> Result<(), AuditError> {
    let mut stmt = conn.prepare(
        "SELECT seq, event, timestamp, prev_hash, hash
         FROM audit_log
         ORDER BY seq ASC",
    )?;

    let mut expected_prev_hash = GENESIS_HASH.to_string();

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
        ))
    })?;

    for (expected_seq, row) in (1_i64..).zip(rows) {
        let (seq, event, timestamp, prev_hash, stored_hash) = row?;

        if seq != expected_seq {
            return Err(AuditError::TamperDetected {
                seq,
                expected: format!("seq {expected_seq}"),
                got: format!("seq {seq}"),
            });
        }

        if prev_hash != expected_prev_hash {
            return Err(AuditError::PrevHashMismatch { seq });
        }

        let recalculated = compute_hash(seq, &event, &timestamp, &prev_hash);
        if stored_hash != recalculated {
            return Err(AuditError::TamperDetected {
                seq,
                expected: recalculated,
                got: stored_hash,
            });
        }

        expected_prev_hash = stored_hash;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::AuditEvent;
    use crate::log::append_event;
    use crate::schema::init_audit_table;
    use uuid::Uuid;

    fn setup_in_memory() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_audit_table(&conn).unwrap();
        conn
    }

    #[test]
    fn test_empty_chain_verifies() {
        let conn = setup_in_memory();
        assert!(verify_chain(&conn).is_ok());
    }

    #[test]
    fn test_valid_chain_verifies() {
        let conn = setup_in_memory();
        let doctor_id = Uuid::new_v4();

        for i in 0..10 {
            append_event(
                &conn,
                &AuditEvent::Login {
                    doctor_id,
                    success: i % 2 == 0,
                },
            )
            .unwrap();
        }

        assert!(verify_chain(&conn).is_ok());
    }

    #[test]
    fn test_tamper_detection_event_mutated() {
        let conn = setup_in_memory();
        let doctor_id = Uuid::new_v4();

        for _i in 0..5 {
            append_event(
                &conn,
                &AuditEvent::RecordViewed {
                    entity_type: "case".into(),
                    entity_id: doctor_id,
                },
            )
            .unwrap();
        }

        // Tamper with record seq = 3 by modifying event text
        conn.execute(
            "UPDATE audit_log SET event = '{\"type\":\"Login\",\"payload\":{\"doctor_id\":\"00000000-0000-0000-0000-000000000000\",\"success\":true}}' WHERE seq = 3",
            [],
        )
        .unwrap();

        let result = verify_chain(&conn);
        assert!(result.is_err());
        match result.unwrap_err() {
            AuditError::TamperDetected { seq, .. } => assert_eq!(seq, 3),
            other => panic!("expected TamperDetected, got {:?}", other),
        }
    }

    #[test]
    fn test_tamper_detection_prev_hash_broken() {
        let conn = setup_in_memory();
        let doctor_id = Uuid::new_v4();

        for _ in 0..4 {
            append_event(&conn, &AuditEvent::AutoLock { doctor_id }).unwrap();
        }

        // Tamper with record seq = 3 prev_hash
        conn.execute(
            "UPDATE audit_log SET prev_hash = '1111111111111111111111111111111111111111111111111111111111111111' WHERE seq = 3",
            [],
        )
        .unwrap();

        let result = verify_chain(&conn);
        assert!(matches!(
            result,
            Err(AuditError::PrevHashMismatch { seq: 3 })
        ));
    }
}
