//! crates/audit — append-only, SHA-256 hash-chained audit log.
//!
//! Patient names and sensitive data MUST NOT appear in audit events.
//! Use IDs only.
#![forbid(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
#![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used, clippy::panic))]

pub mod error;
pub mod events;
pub mod log;
pub mod schema;
pub mod verify;
