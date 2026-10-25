//! crates/store — encrypted SQLite persistence via SQLCipher.
#![forbid(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
#![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used, clippy::panic))]

pub mod cases;
pub mod db;
pub mod doctors;
pub mod error;
pub mod findings;
pub mod key;
pub mod migrations;
pub mod patients;
pub mod seed;
