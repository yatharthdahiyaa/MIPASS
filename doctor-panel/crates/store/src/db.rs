//! Database connection: opens SQLCipher-encrypted SQLite, applies migrations.
use crate::error::StoreError;
use crate::key::DbKey;
use rusqlite::{Connection, OpenFlags};

/// Open or create the encrypted database at `path` using `key`.
///
/// Applies the PRAGMA key immediately and runs pending migrations.
/// The key bytes are zeroized after being passed to SQLCipher.
pub fn open(path: &std::path::Path, key: &DbKey) -> Result<Connection, StoreError> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
    )?;

    // Pass the key as a binary hex string so it is treated as a raw key
    // (not a passphrase KDF). SQLCipher docs: PRAGMA key = "x'<hex>'"
    let hex_key = hex::encode(key.as_ref());
    conn.execute_batch(&format!("PRAGMA key = \"x'{hex_key}'\";"))?;

    // Verify the key is correct (PRAGMA user_version is readable only on a valid DB)
    conn.execute_batch("PRAGMA user_version;")?;

    // Performance settings
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;",
    )?;

    crate::migrations::run(&conn)?;

    Ok(conn)
}

/// Convenience: in-memory encrypted DB for tests/fallbacks.
pub fn open_in_memory() -> Result<Connection, StoreError> {
    let conn = Connection::open_in_memory()?;
    // In-memory: key required but any value works since data is ephemeral
    conn.execute_batch(
        "PRAGMA key = \"x'0000000000000000000000000000000000000000000000000000000000000000'\";",
    )?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;",
    )?;
    crate::migrations::run(&conn)?;
    Ok(conn)
}

/// Execute a PRAGMA key=off to strip encryption (export). Unused in M1; placeholder.
pub fn export_plain(_conn: &Connection, _dest: &std::path::Path) -> Result<(), StoreError> {
    Err(StoreError::InvalidData(
        "export_plain not implemented in M1".into(),
    ))
}

/// Run a simple SELECT 1 to confirm the DB is accessible.
pub fn health_check(conn: &Connection) -> Result<(), StoreError> {
    conn.execute_batch("SELECT 1;")?;
    Ok(())
}
