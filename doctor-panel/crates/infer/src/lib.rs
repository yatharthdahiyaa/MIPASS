//! crates/infer — Model trait, signed-bundle verification, and MockModel.
#![forbid(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
#![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used, clippy::panic))]

pub mod bundle;
pub mod error;
pub mod mock;
pub mod model;
pub mod protocol;
pub mod registry;

pub use bundle::{verify_manifest_signature, verify_model_payload, BundleManifest};
pub use error::InferError;
pub use mock::MockModel;
pub use model::{CancelToken, Model, ModelInput, ModelOutput};
pub use protocol::{
    read_frame, send_host_msg, send_worker_msg, write_frame, HostMessage, WorkerMessage,
    MAX_FRAME_SIZE,
};
pub use registry::ModelRegistry;
