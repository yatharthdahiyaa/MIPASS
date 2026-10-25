use crate::error::InferError;
use crate::model::{CancelToken, Model, ModelInput, ModelOutput};
use doctor_core::types::{ModelInfo, RawFinding};
use sha2::{Digest, Sha256};
use std::time::Instant;

pub const MOCK_MODEL_ID: &str = "mock-cxr";
pub const MOCK_MODEL_VERSION: &str = "1.0.0";
pub const MOCK_BUNDLE_SHA256: &str =
    "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";

pub struct MockModel {
    info: ModelInfo,
}

impl Default for MockModel {
    fn default() -> Self {
        Self::new()
    }
}

impl MockModel {
    pub fn new() -> Self {
        Self {
            info: ModelInfo {
                id: MOCK_MODEL_ID.to_string(),
                version: MOCK_MODEL_VERSION.to_string(),
                bundle_sha256: MOCK_BUNDLE_SHA256.to_string(),
            },
        }
    }
}

impl Model for MockModel {
    fn info(&self) -> &ModelInfo {
        &self.info
    }

    fn run(
        &self,
        input: &ModelInput,
        cancel_token: &CancelToken,
    ) -> Result<ModelOutput, InferError> {
        let start = Instant::now();

        if cancel_token.is_cancelled() {
            return Err(InferError::Cancelled);
        }

        // Derive deterministic pseudo-random seeds from SHA-256 of input reference
        let mut hasher = Sha256::new();
        hasher.update(input.synthetic_image_ref.as_bytes());
        let hash = hasher.finalize();

        if cancel_token.is_cancelled() {
            return Err(InferError::Cancelled);
        }

        // Deterministic finding 1: consolidation
        let byte0 = hash[0];
        let conf1 = 0.50 + ((byte0 as f32) / 255.0) * 0.45; // 0.50 .. 0.95

        // Deterministic finding 2: cardiomegaly or pleural effusion
        let byte1 = hash[1];
        let (label2, conf2) = if byte1 > 128 {
            ("pleural effusion", 0.60 + ((byte1 as f32) / 512.0) * 0.35)
        } else {
            (
                "no pleural effusion",
                0.85 + ((byte1 as f32) / 256.0) * 0.14,
            )
        };

        // Deterministic finding 3: pulmonary edema
        let byte2 = hash[2];
        let conf3 = 0.70 + ((byte2 as f32) / 255.0) * 0.25;

        let findings = vec![
            RawFinding {
                label: "consolidation".to_string(),
                confidence: (conf1 * 100.0).round() / 100.0,
            },
            RawFinding {
                label: label2.to_string(),
                confidence: (conf2 * 100.0).round() / 100.0,
            },
            RawFinding {
                label: "pulmonary edema".to_string(),
                confidence: (conf3 * 100.0).round() / 100.0,
            },
        ];

        let elapsed = start.elapsed().as_millis() as u64;

        Ok(ModelOutput {
            findings,
            run_duration_ms: elapsed,
        })
    }

    fn unload(&mut self) -> Result<(), InferError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_is_deterministic() {
        let model = MockModel::new();
        let cancel = CancelToken::new();
        let input = ModelInput {
            synthetic_image_ref: "synthetic-cxr-case-42.png".into(),
            metadata: serde_json::json!({ "modality": "CXR" }),
        };

        let out1 = model.run(&input, &cancel).unwrap();
        let out2 = model.run(&input, &cancel).unwrap();

        assert_eq!(out1.findings.len(), out2.findings.len());
        for (f1, f2) in out1.findings.iter().zip(out2.findings.iter()) {
            assert_eq!(f1.label, f2.label);
            assert_eq!(f1.confidence, f2.confidence);
        }
    }

    #[test]
    fn mock_handles_cancellation() {
        let model = MockModel::new();
        let cancel = CancelToken::new();
        cancel.cancel();
        let input = ModelInput {
            synthetic_image_ref: "synthetic-cxr-cancel.png".into(),
            metadata: serde_json::Value::Null,
        };

        assert!(matches!(
            model.run(&input, &cancel),
            Err(InferError::Cancelled)
        ));
    }
}
