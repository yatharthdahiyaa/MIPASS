use crate::error::InferError;
use doctor_core::types::{ModelInfo, RawFinding};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Clone, Default, Debug)]
pub struct CancelToken {
    cancelled: Arc<AtomicBool>,
}

impl CancelToken {
    pub fn new() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelInput {
    pub synthetic_image_ref: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelOutput {
    pub findings: Vec<RawFinding>,
    pub run_duration_ms: u64,
}

pub trait Model: Send + Sync {
    fn info(&self) -> &ModelInfo;
    fn run(
        &self,
        input: &ModelInput,
        cancel_token: &CancelToken,
    ) -> Result<ModelOutput, InferError>;
    fn unload(&mut self) -> Result<(), InferError>;
}
