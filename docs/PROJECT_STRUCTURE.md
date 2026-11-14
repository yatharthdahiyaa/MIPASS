# Project Structure

```
.
├── apps/
│   ├── backend/        Flask API, agents, workers, tests        (Python)
│   ├── frontend/       Next.js web app                           (TypeScript)
│   ├── desktop/        Doctor diagnostic panel, Tauri 2 + Rust   (Rust / TypeScript)
│   └── iam-rbac/       Standalone IAM / RBAC service + admin UI  (Node)
├── data/               Local runtime data (git-ignored contents)
│   ├── samples/        Sample DICOM files for tests / demos
│   ├── uploads/        Local upload staging
│   └── model_cache/    Cached model weights
├── ml/                 Model source repos + trained checkpoints (git-ignored)
├── infra/database/     standalone Postgres + Adminer compose, DB guide
└── docs/               Architecture and product specs
```

## Backend (`apps/backend`)

| Path | Role |
|---|---|
| `app/routes/` | HTTP layer. All blueprints are registered in `routes/__init__.py` under `/api/v1` |
| `app/services/`, `app/agents/` | Business logic |
| `app/database/` | ORM models + session (single central DB package) |
| `app/paths.py` | **All filesystem locations** (data, DB, samples, ML, caches) |
| `config/diseases/` | Disease YAML configs |
| `models/` | Python model wrappers (the weights live in `ml/`) |
| `scripts/` | CLI tools (`init_db.py`), `run_*.py` entry points stay at backend root |

### API conventions

- Every route is served under `/api/v1/<resource>`; blueprints declare paths **without** the prefix.
- To add an endpoint group: create the blueprint in `app/routes/` and append it to `_BLUEPRINTS` in `routes/__init__.py`.
- Resources: `health`, `upload`, `jobs`, `diseases`, `inference`, `auth`, `rbac`, `emr`, `eka`, `abdm`, `agents`, `worklist`, `cases`, `admin`, `patient`, `developer`, `database`.

### Data path overrides

| Variable | Default |
|---|---|
| `MIPAAS_DATA_DIR` | `<repo>/data` |
| `MIPAAS_ML_DIR` | `<repo>/ml` |
| `MODEL_CACHE_DIR` | `<data>/model_cache` |
| `DISEASE_CONFIG_DIR` | `apps/backend/config/diseases` |
| `DATABASE_URL` | PostgreSQL URL; defaults to the Docker stack at `127.0.0.1:5432/mipaas_central` |

## Frontend (`apps/frontend/src`)

| Path | Role |
|---|---|
| `app/` | Next.js routes (pages are thin wrappers) |
| `portals/{admin,doctor,openemr}/` | Portal implementations, one folder per portal |
| `components/` | Shared / marketing / product components (no portal code) |
| `config/api.ts` | Backend and IAM origins + `/api/v1` prefix; mirrored by `next.config.ts` rewrites |
| `services/`, `context/`, `types/` | API clients, React context, shared types |

Env: `NEXT_PUBLIC_API_ORIGIN` (default `http://localhost:8080`), `NEXT_PUBLIC_IAM_ORIGIN` (default `http://localhost:5000`).

## AI agents

See `docs/AGENTS.md`: four agents (health assistant record access, report explainer, pre-consultation brief, report draft), the consent and minimisation rules, the run log (`agent_runs`), the safety check, and how to add one. Gateway: `app/services/agents.py` and `app/routes/agents.py`; agents: `apps/agents/CareAgents/`.

## Running in production

See `docs/LAUNCH_CHECKLIST.md` for what is and is not ready. In short: `infra/deploy/` holds a single-host stack (Caddy for HTTPS, web, API, PostgreSQL, Redis, a migration step); the API validates its configuration at start-up outside development (`app/preflight.py`); the schema is owned by Alembic (`apps/backend/migrations/`, development still creates tables on start-up); CI is `.github/workflows/ci.yml`.


## Authentication (central database)

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/auth/register` | Self sign-up, signs in. `account_type`: `patient` (role `patient`) or `doctor` (role `doctor_pending`; needs `license_number` + `specialty`) |
| `POST /api/v1/auth/login` | Email or username + password; `remember` = 30-day cookie. With two-step verification on it returns `{mfa_required, mfa_token}` instead of a session, unless `mfa_code` is sent in the same request |
| `POST /api/v1/auth/mfa/verify` | `{mfa_token, code}` completes the sign-in (authenticator code or a single-use recovery code) |
| `GET /api/v1/auth/mfa`, `POST /auth/mfa/setup|enable|disable|recovery-codes` | Two-step verification (TOTP). Secrets are encrypted with `MFA_ENCRYPTION_KEY` |
| `POST /api/v1/auth/verify-email/request|confirm` | E-mail verification (link valid 24 h). Required before inviting a care connection |
| `POST /api/v1/auth/password/forgot|reset|change` | Reset by e-mailed link (valid 1 h, signs out every device) or change while signed in (signs out the other devices) |
| `GET /api/v1/auth/sessions`, `DELETE /auth/sessions/<id>`, `POST /auth/sessions/revoke-others` | Signed-in devices |
| `PATCH /api/v1/auth/profile` | Name, phone, organisation, locale; doctors also specialty, bio, listing |
| `POST /api/v1/auth/logout` | Revokes the session |
| `GET /api/v1/auth/session` | Current user or `authenticated: false` |
| `POST /api/v1/audit/events` | Records a client-side clinical action for the signed-in user |

- Passwords: Werkzeug scrypt hashes in `users.password_hash`. Sessions: random tokens, stored as SHA-256 in `user_sessions` (12 h, or 30 days with "remember me"), sent as an HttpOnly `SameSite=Lax` cookie `mipaas_session`.
- `app/middleware/auth_middleware.py` resolves this session first, so every `@require_auth` / `@require_permission` route works with real accounts. Roles and permissions: `app/services/rbac.py`.
- Legacy caller-chosen identities (`X-User-ID`, `X-User-Role`, `Bearer test-token-*`) and `POST /auth/switch-role` only work in tests or with `MIPAAS_ALLOW_HEADER_AUTH=1`.
- Login is throttled (5 failures per identifier + IP per 15 min) and every sign-up, sign-in and sign-out is written to `audit_logs`.
- Provision or promote users: `python scripts/manage_users.py create|set-role|set-password|deactivate|list` (from `apps/backend`).
- Doctors stay `doctor_pending` (no clinical permissions) until verified: `python scripts/manage_users.py pending-doctors`, then `verify-doctor --email <e> --by <who checked>`.
- E-mail: `app/services/mailer.py` writes every message to `email_outbox`; `MAIL_BACKEND` (`outbox`, `console`, `smtp`) decides delivery. With the default `outbox`, read the links with `python scripts/manage_users.py outbox`. Links point at `APP_BASE_URL`.
- Frontend: `src/lib/auth/` (`SessionProvider`, `useSession`, `useAccess`); pages `/login` (with the two-step code step), `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account` (security settings in `components/auth/SecurityPanel.tsx`: two-step verification, password, devices, e-mail notification preferences). Browser calls go through the `/api/v1` rewrite so the cookie stays first-party. After sign-in users land on `user.home` from the API (`/patient`, `/doctor`, `/admin` or `/account`).
- The two-step setup QR code is drawn in the browser by `src/lib/qr.ts` (a small dependency-free encoder), so the secret is never sent to an image service.
- Layout conventions worth keeping: `Card` (`components/patient/ui.tsx`) carries `min-w-0` so cards shrink inside grids on phones, and a screen whose main action sits bottom-right (the message composer) sets `data-hide-assistant` so the floating assistant button steps aside (rule in `components/home/tokens.css`).

## Patient portal (EHR)

API: `app/routes/patient_portal.py` (all under `/api/v1/patient/*`, role `patient` only, scoped to the caller's own rows), logic in `app/services/patient_ehr.py`, tables in `app/database/models/patient_ehr.py` (`patient_profiles`, `patient_daily_logs`, `patient_medications`, `patient_medication_doses`, `patient_documents`, `patient_xray_studies`). Nothing is seeded; every row comes from the patient.

- Uploaded files live under `PATIENT_FILES_DIR` (default `data/uploads/patients/<user_id>/`), max `PATIENT_MAX_UPLOAD_BYTES` (25 MB). Put this on encrypted storage in production.
- X-ray uploads run the chest X-ray model synchronously (the CheXpert ensemble in `ml/chexpert_ensemble.pth`, see `docs/CHEST_XRAY_MODEL.md`); only the findings, preview and Grad-CAM map are stored.
- Adding, deleting or a doctor reviewing an X-ray writes an event to the patient's Redis stream (`app/services/events.py`), so the patient chat knows about it (`docs/AGENTS.md`, "Record updates").
- `GET /api/v1/patient/export` returns the full record as JSON.
- Frontend: `src/app/patient/*` pages, `src/components/patient/*`, client `src/lib/patient/api.ts`.

## Care connections, messaging and notifications

API: `app/routes/care.py` (notifications and messaging, both roles) plus the care sections of `patient_portal.py` and `doctor_panel.py`; logic in `app/services/care.py` and `app/services/notify.py`; tables in `app/database/models/care.py`.

- A care link joins one patient and one verified doctor. Either side invites (patients by the doctor's `DR-` share code or e-mail), the other accepts, either can end it. The patient chooses the shared scopes (`profile`, `vitals`, `medications`, `documents`, `xrays`); the doctor reads only those, and only while the link is active.
- Inside an active link: secure messages, consultation requests (`video`, `in_person`, `chat`) and clinician reviews of patient X-rays. Every write notifies the other side; out-of-range vitals and flagged screenings raise alerts for the patient and for doctors who share that scope.
- Notifications are stored per user (`GET /api/v1/notifications`, cheap poll at `/notifications/badge`) and copied to e-mail according to `/notifications/preferences`.
- Patient side (web): `/patient/care` (`components/patient/views/CareView.tsx`, tabs for doctors, messages and consultations), the bell in `components/care/NotificationBell.tsx`, client `src/lib/care/api.ts`.
- Doctor side (desktop app): the Patients, Messages and Consultations sections of `apps/desktop` (see its README). There are no doctor care pages on the web: `/doctor` points to the desktop app, and the web paths the server puts in doctor notifications (`/doctor/patients`, `/doctor/inbox`, `/doctor/consults`) are mapped to desktop screens by the app. In a doctor's notification e-mail those links therefore lead nowhere useful yet.
- `shared_record` reads vitals up to one day past UTC today, because a log's date is the patient's local day.

## Administration (web)

`/admin` (`components/admin/AdminView.tsx`, client `src/lib/admin/api.ts`, API `app/routes/admin.py`). Administrators land here after sign-in; auditors reach the audit log from a link on `/account`. Tabs: overview counts, doctor verification (verify or reject with a reason), users (search, role, deactivate, confirm e-mail), audit log (`audit:read`), and the e-mail outbox. The outbox returns message text only when `MAIL_BACKEND` is `outbox` or `console`; with `smtp` the text is withheld, because it contains other people's verification and password-reset links.

## Languages

`src/lib/i18n/`: English, हिन्दी, বাংলা, தமிழ், తెలుగు. The choice is stored in the `mipaas_lang` cookie and read by the root layout, so pages render server-side in that language. Add a language by adding it to `config.ts` and a `messages/<code>.ts` file typed as `Messages` (the compiler enforces every key). Auth pages, nav, account and the patient portal are translated; marketing sections and the doctor workstation are still English-only. The administration console is English-only as well. Account security, care connections and notifications are English-only too: their strings live in `messages/extra.ts`, merged into English only, and other locales fall back to it.


## Doctor diagnostic panel (desktop)

`apps/desktop` (Tauri 2 + Rust, see its README) is the clinician workspace. It uses `/api/v1/doctor/*`
(`app/routes/doctor_panel.py`, table `doctor_studies`, files under `DOCTOR_FILES_DIR`, default
`data/uploads/doctors/`). Only roles `doctor`, `radiologist`, `admin`; each doctor sees only their own studies;
signed reports are locked. Desktop sign-in sends `client: "desktop"` to `/auth/login` and receives a bearer
token in the body (clinician roles only); the web login never returns a token. If the doctor has two-step
verification on, the app asks for the code and repeats the login with `mfa_code`.
