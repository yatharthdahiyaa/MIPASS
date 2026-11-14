# MIPAAS Diagnostic Panel (desktop)

A Tauri 2 + Rust desktop app for **verified doctors**: upload an imaging study, review the AI result
(findings, severity, attention map), write an impression, sign, and export an HTML report.

The panel is model-agnostic. Each model is a *study analyser* registered on the backend
(`apps/backend/app/services/study_analysis.py`); the panel lists them from `GET /doctor/analyzers`
and the server picks the right one for each upload.

It is also the doctor's side of **care connections**: patients who share their MIPAAS record, secure
messages, consultation requests and notifications (see "Patients, messages and consultations" below).

It talks to the MIPAAS Flask API (`apps/backend`) through the `/api/v1/doctor/*`, `/api/v1/care/*` and
`/api/v1/notifications*` routes. Nothing is stored locally except the server address.

## Run

```powershell
# 1. backend (from apps/backend)
python wsgi.py                          # http://127.0.0.1:8080 by default

# 2. desktop app (from apps/desktop)
npm install
npm run app                             # = tauri dev; first build compiles the Rust crates (a few minutes)
npm run bundle                          # = tauri build -> .msi / .exe installers in src-tauri/target/release/bundle
```

If the backend runs elsewhere (e.g. port 8091), change the address on the sign-in screen, or start the
app with `MIPAAS_SERVER_URL=http://127.0.0.1:8091`. The address is saved in
`%APPDATA%\health.mipaas.diagnostic\config.json`.

## Study lifecycle

| Status | Meaning |
|---|---|
| `completed` | The analyser ran; findings, severity and images are stored. |
| `pending` | No trained model is installed for that study type yet. The file is kept. |
| `failed` | The model raised (unreadable pixels, bad weights, ...). Can be re-run. |

Reports go `draft` → `signed`. Signed reports are locked: no edits, re-analysis or deletion.

**Automatic execution:** uploads are analysed immediately. When the panel opens it calls
`POST /doctor/studies/analyze`, which analyses every waiting (`pending`/`failed`) draft whose model is
now installed. A single study can also be re-run with **Run analysis** (`POST /doctor/studies/<id>/analyze`).

## Patients, messages and consultations

The top bar switches between four sections; counts next to a section are things waiting for the doctor.

| Section | What it does |
|---|---|
| Studies | The worklist described above. |
| Patients | The doctor's share code (patients type it on the website), invite-by-e-mail, connection requests to accept or decline, and the shared record of each connected patient: profile, self-logged vitals (out-of-range readings highlighted with the server's alert limits), medicines and adherence, uploaded documents (saved through a native dialog), and patient-uploaded X-rays with the AI screening, viewer and a review form. Only the areas the patient shared are returned. |
| Messages | One conversation per connected patient. Polls every 10 seconds while the window is visible. |
| Consultations | Requests to schedule (in the doctor's local time), reschedule, decline or mark complete, each with an optional note to the patient. |

The bell lists notifications (vitals alerts, flagged screenings, messages, requests). The server attaches web
paths to them (`/doctor/inbox?link=...`); `components/care/common.tsx` maps those onto the sections above.
Rust commands for all of this are in `src-tauri/src/care.rs`.

## Adding a model

1. Subclass `StudyAnalyzer` in `app/services/study_analysis.py` (`id`, `modality`, `display_name`,
   `is_available`, `accepts`, `analyze` → `AnalysisResult`), then `register(...)` it in `_register_builtin`.
2. Severity must be one of `NORMAL`, `MODERATE`, `HIGH`, `CRITICAL` (or none).
3. Nothing else changes: the API, the desktop app and the report export pick it up.

The built-in chest X-ray analyser is the CheXpert ensemble in `ml/chexpert_ensemble.pth` (override with
`MIPAAS_CXR_CHECKPOINT`); see `docs/CHEST_XRAY_MODEL.md`. Until that file exists, chest X-ray uploads stay `pending`.

## Who can sign in

Only accounts with role `doctor`, `radiologist` or `admin`. Doctors register on the website and stay
`doctor_pending` until verified (by an administrator at `/admin` on the website, or from the command line):

```powershell
python scripts/manage_users.py pending-doctors
python scripts/manage_users.py verify-doctor --email dr@clinic.org --by "Your name"
```

## How it is wired (security)

| Concern | Design |
|---|---|
| Network | Only Rust (`src-tauri/src/api.rs`) makes HTTP calls. CSP limits the webview to `ipc:`; it can't reach the network. |
| Session | `POST /auth/login` with `client: "desktop"` returns a bearer token (no cookie). It lives only in Rust memory, never in the webview, and is revoked on sign-out. Closing the app ends the session locally. |
| Two-step verification | If the account has it on, the server answers `mfa_required`; the app asks for the code and repeats the login with `mfa_code` (authenticator or recovery code). No challenge token reaches the webview. |
| Server address | Plain `http://` is accepted only for this computer (loopback); remote servers must be `https://`. Changing the server drops the session. |
| Files | Rust opens the file dialogs. The UI receives an opaque id for a picked file, never a path, and can't ask Rust to read arbitrary files. Uploads are limited to `.dcm/.dicom/.png/.jpg/.jpeg/.webp`, 25 MB. |
| Images | Fetched by Rust with the token and handed to the UI as `data:` URLs. |
| Input | Ids, filters, image kinds and actions are validated in Rust before they reach a URL; only whitelisted fields are forwarded on update. |
| Patient documents | Downloaded by Rust and written only where the doctor picks in a native save dialog; the patient's file name is reduced to a plain name first. |
| Capabilities | `capabilities/default.json` grants `core:default` only; no fs/shell/dialog permissions to JavaScript. |
| Reports | Signed reports are locked server-side (no edits or deletes). Exported reports are self-contained HTML with their own restrictive CSP. |

## Tests

```powershell
cargo test --manifest-path src-tauri/Cargo.toml            # unit tests (server-address rules)
# end-to-end against a running backend with a verified doctor:
$env:MIPAAS_E2E_SERVER="http://127.0.0.1:8080"; $env:MIPAAS_E2E_EMAIL="..."; $env:MIPAAS_E2E_PASSWORD="..."
$env:MIPAAS_E2E_XRAY="..\..\data\samples\sample_cxr.dcm"   # needs the chest X-ray model installed
cargo test --manifest-path src-tauri/Cargo.toml e2e -- --ignored
```

Backend side (from `apps/backend`): `pytest`. `tests/test_accounts_flow.py` covers the desktop sign-in
(including two-step verification) and the care calls this app makes with a bearer token. It needs the
PostgreSQL test database but no model weights.
