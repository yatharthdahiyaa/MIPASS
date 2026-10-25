# mipaas Doctor Panel — System Architecture

## Overview
Offline-first Windows desktop application for clinicians to review patient records, run local on-device decision support models, and document findings.

```
+-------------------------------------------------------------+
|                          Webview UI                         |
|     (React 19 + TypeScript + Vite, strictly offline/CSP)     |
+------------------------------+------------------------------+
                               | Tauri IPC (invoke)
+------------------------------v------------------------------+
|                         crates/app                          |
|         Tauri 2 Host Process (Session, Auth, Router)         |
+----------------+-------------+---------------+--------------+
                 |             |               |
                 v             v               v
+----------------+--+   +------+------+  +-----+--------------+
|   crates/core     |   | crates/store|  |   crates/audit     |
|   Pure Domain     |   |  SQLCipher  |  | SHA-256 Hash-Chain |
|   Types (No I/O)  |   |  Keyring    |  | Append-Only Log    |
+-------------------+   +-------------+  +--------------------+
                               |
                               | Stdio IPC (Length-prefixed JSON)
+------------------------------v------------------------------+
|                      crates/infer-worker                    |
|          Sidecar Process (Memory capped, Isolated)          |
|                 +--------------------------+                |
|                 |       crates/infer       |                |
|                 | Model trait, MockModel,  |                |
|                 | Ed25519 Bundle Verifier  |                |
|                 +--------------------------+                |
+-------------------------------------------------------------+
```

## Security & Safety Guardrails
1. **Decision Support Language**: UI exclusively uses "AI suggests: ..." or "model finding: ...", never declaring a definitive diagnosis.
2. **Explicit Physician Review**: AI findings are never written to the permanent clinical record without explicit Accept, Edit, or Reject doctor action.
3. **Signed Model Bundles**: Only bundles signed with valid Ed25519 signatures and verified SHA-256 checksums can be loaded.
4. **Append-Only Tamper-Evident Audit**: Every login, record view, AI run, and doctor action is stored in an SHA-256 hash-chained log. Verified at startup.
5. **No PHI in Traces**: Patient names, dates of birth, and health notes never appear in audit events, error messages, or logs. Only UUIDs are tracked.
6. **Encrypted Storage**: SQLCipher 256-bit AES encryption. Encryption key is managed by Windows Credential Manager.
