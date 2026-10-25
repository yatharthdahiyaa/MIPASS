//! Signed bundle verification using Ed25519 and SHA-256.
use crate::error::InferError;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleManifest {
    pub model_id: String,
    pub version: String,
    pub model_sha256: String,
}

/// Verify Ed25519 signature over manifest JSON bytes and parse manifest.
pub fn verify_manifest_signature(
    manifest_bytes: &[u8],
    signature_bytes: &[u8; 64],
    pubkey_bytes: &[u8; 32],
) -> Result<BundleManifest, InferError> {
    let verifying_key = VerifyingKey::from_bytes(pubkey_bytes)
        .map_err(|e| InferError::Signature(format!("invalid public key: {e}")))?;

    let signature = Signature::from_bytes(signature_bytes);

    verifying_key
        .verify(manifest_bytes, &signature)
        .map_err(|e| InferError::Signature(format!("signature verification failed: {e}")))?;

    let manifest: BundleManifest = serde_json::from_slice(manifest_bytes)
        .map_err(|e| InferError::InvalidBundle(format!("corrupt manifest JSON: {e}")))?;

    Ok(manifest)
}

/// Verify that model binary payload matches the SHA-256 declared in the verified manifest.
pub fn verify_model_payload(model_bytes: &[u8], expected_sha256: &str) -> Result<(), InferError> {
    let mut hasher = Sha256::new();
    hasher.update(model_bytes);
    let calculated = hex::encode(hasher.finalize());

    if calculated.eq_ignore_ascii_case(expected_sha256) {
        Ok(())
    } else {
        Err(InferError::HashMismatch {
            expected: expected_sha256.to_string(),
            got: calculated,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    #[test]
    fn test_valid_bundle_signature_and_hash() {
        let mut key_bytes = [0u8; 32];
        rand::fill(&mut key_bytes);
        let signing_key = SigningKey::from_bytes(&key_bytes);
        let pubkey = signing_key.verifying_key().to_bytes();

        let fake_model = b"fake-onnx-model-binary-weights";
        let mut hasher = Sha256::new();
        hasher.update(fake_model);
        let model_sha256 = hex::encode(hasher.finalize());

        let manifest = BundleManifest {
            model_id: "mock-cxr".into(),
            version: "1.0.0".into(),
            model_sha256: model_sha256.clone(),
        };
        let manifest_bytes = serde_json::to_vec(&manifest).unwrap();
        let sig = signing_key.sign(&manifest_bytes).to_bytes();

        let verified = verify_manifest_signature(&manifest_bytes, &sig, &pubkey).unwrap();
        assert_eq!(verified.model_id, "mock-cxr");

        let hash_check = verify_model_payload(fake_model, &verified.model_sha256);
        assert!(hash_check.is_ok());
    }

    #[test]
    fn test_tampered_manifest_rejected() {
        let mut key_bytes = [0u8; 32];
        rand::fill(&mut key_bytes);
        let signing_key = SigningKey::from_bytes(&key_bytes);
        let pubkey = signing_key.verifying_key().to_bytes();

        let manifest = BundleManifest {
            model_id: "mock-cxr".into(),
            version: "1.0.0".into(),
            model_sha256: "0000".into(),
        };
        let manifest_bytes = serde_json::to_vec(&manifest).unwrap();
        let sig = signing_key.sign(&manifest_bytes).to_bytes();

        // Mutate manifest
        let mut tampered = manifest_bytes.clone();
        tampered[10] ^= 0xFF;

        let res = verify_manifest_signature(&tampered, &sig, &pubkey);
        assert!(res.is_err());
    }

    #[test]
    fn test_tampered_model_payload_rejected() {
        let res = verify_model_payload(b"tampered content", "deadbeef");
        assert!(matches!(res, Err(InferError::HashMismatch { .. })));
    }
}
