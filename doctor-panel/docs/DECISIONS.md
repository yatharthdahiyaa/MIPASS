# Architectural Decisions Log

This document records the architectural and design decisions made for `doctor-panel`.

| # | Decision | Status | Rationale |
|---|----------|--------|-----------|
| **D-001** | **Tauri 2 (stable) not Tauri 3 alpha** | Accepted | M1 requires stable runtime; Tauri 3.0 alpha introduces unstable breaking changes. |
| **D-002** | **`rusqlite` + `bundled-sqlcipher`** | Accepted | SQLCipher built from source via feature flag; avoids external C library installation on Windows target machines. |
| **D-003** | **`keyring` for DB encryption key** | Accepted | Stores the 32-byte encryption key in Windows Credential Manager; avoids plaintext keys on disk or config. |
| **D-004** | **`ed25519-dalek` for bundle signing** | Accepted | Audited pure-Rust cryptographic signing; verifies manifest and bundle integrity before loading. |
| **D-005** | **Mock model only in Milestone 1** | Accepted | `ort` / ONNX integration is pinned and isolated to Milestone 2 behind `--features onnx`. |
| **D-006** | **pnpm workspace for UI** | Accepted | Fast, deterministic package resolution without npm hoist anomalies. |
| **D-007** | **Direct rusqlite without heavy ORM** | Accepted | Avoids heavy Diesel / SQLx macros and compile times; domain schema is concise. |
| **D-008** | **Zero PHI in logs and exceptions** | Accepted | Clinical safety rule: only UUIDs and content hashes appear in audit logs and traces. |
| **D-009** | **Length-prefixed JSON IPC over stdio** | Accepted | No TCP ports opened on localhost; immune to local port collisions and firewall restrictions. |
| **D-010** | **System font stack & offline assets** | Accepted | Hard offline constraint: no Google Fonts, CDN links, or external runtime requests. |
