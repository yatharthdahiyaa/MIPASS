//! OS credential store key management. Key never written to disk or source.
//!
//! On first call, generates a 32-byte random key, stores it in the OS keyring.
//! Subsequent calls retrieve it. The key is Zeroize'd when the DbKey is dropped.

use crate::error::StoreError;
use zeroize::Zeroizing;

const SERVICE: &str = "mipaas-doctor";
const USERNAME: &str = "db-encryption-key";

/// A 32-byte key that zeroes itself on drop.
pub type DbKey = Zeroizing<[u8; 32]>;

pub fn create_key_from_slice(slice: &[u8; 32]) -> DbKey {
    Zeroizing::new(*slice)
}

/// Retrieve or generate the database encryption key.
pub fn load_or_create_key() -> Result<DbKey, StoreError> {
    let kr =
        keyring::Entry::new(SERVICE, USERNAME).map_err(|e| StoreError::Keyring(e.to_string()))?;

    match kr.get_password() {
        Ok(hex_key) => {
            let raw = hex::decode(hex_key.trim())
                .map_err(|e| StoreError::Keyring(format!("bad stored key: {e}")))?;
            if raw.len() != 32 {
                return Err(StoreError::Keyring("stored key wrong length".into()));
            }
            let mut key = Zeroizing::new([0u8; 32]);
            key.copy_from_slice(&raw);
            Ok(key)
        }
        Err(keyring::Error::NoEntry) => {
            let mut key = Zeroizing::new([0u8; 32]);
            rand::fill(&mut *key);
            let hex_key = hex::encode(key.as_ref());
            kr.set_password(&hex_key)
                .map_err(|e| StoreError::Keyring(format!("set_password failed: {e}")))?;
            log::info!("store::key: new DB key created and stored in OS keyring");
            Ok(key)
        }
        Err(e) => Err(StoreError::Keyring(e.to_string())),
    }
}

pub fn get_or_create_key() -> Result<DbKey, StoreError> {
    load_or_create_key()
}

/// Mock key loader for tests — does NOT touch the OS keyring.
#[cfg(test)]
pub fn test_key() -> DbKey {
    Zeroizing::new([0u8; 32])
}
