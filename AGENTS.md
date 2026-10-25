# mipaas Doctor Panel

Offline-first Windows desktop app for doctors: view patients, run on-device AI models, review and record findings. Tauri 2 + Rust core, React/TypeScript UI.

## Hard constraints
- Minimum target PC: Intel Core i5 (4 cores), 8 GB RAM, SSD, no GPU assumed. Test against this floor, not the dev machine.
- Memory budget: webview/UI ~400 MB, Rust core + DB ~150 MB, inference worker <= 1.5 GB, image cache <= 500 MB.
- The diagnosis path works fully offline. No network calls, telemetry, CDN assets or web fonts at runtime.
- AI is decision support only. A doctor reviews every AI output.

## Architecture (Cargo workspace)
- `crates/app`: Tauri shell, commands, session
- `crates/core`: domain types (Patient, Case, Finding, Report). No I/O.
- `crates/store`: encrypted SQLite (rusqlite + SQLCipher), migrations
- `crates/audit`: append-only SHA-256 hash-chained log
- `crates/dicom`: parsing and frame decode (dicom-rs)
- `crates/infer`: Model trait, registry, signed-bundle verification, backends (mock, onnx via ort)
- `crates/infer-worker`: separate binary run as a Tauri sidecar; one model loaded at a time; unloads when idle
- `ui/`: React + TypeScript + Vite
IPC app <-> worker: length-prefixed JSON over stdio. No listening TCP ports.

## Commands
- `cargo fmt --all`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `pnpm --dir ui test`

## Working agreement
- Work one milestone at a time. Stop at the end of each milestone, summarize, and wait for review.
- Record decisions in `docs/DECISIONS.md`.
- Synthetic data only. Never use or invent real patient data.
- Prefer small diffs. Before adding a crate, check its current docs and pin the exact version. Justify new dependencies in DECISIONS.md.
