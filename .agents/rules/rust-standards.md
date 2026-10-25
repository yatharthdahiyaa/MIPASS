# Rust standards
- Pin the stable toolchain in rust-toolchain.toml.
- No unwrap, expect or panic in non-test code. Use thiserror in libraries, anyhow only at app boundaries.
- #![forbid(unsafe_code)] everywhere except unavoidable FFI; document each unsafe block.
- The ort crate is a release-candidate crate: pin the exact version, wrap it behind the crates/infer trait, and gate it behind an `onnx` feature.
- Never load a whole imaging volume as f32. Process slices or tiles and bound all caches by bytes.
- Inference must be cancellable and time-limited. A worker crash must never crash the app.
- Tests required: core unit tests, audit tamper-detection test, store migration test, worker IPC test using the mock model.
- Run cargo audit and cargo deny if available.
