# Launch checklist

What stands between this repository and serving real patients. The first section is built and
tested; the rest cannot be solved in code and needs a decision, a contract or a professional.

## In the repository

| Area | What exists | Where |
|---|---|---|
| Unsafe configuration | Outside development the API refuses to start with a default secret, no MFA key, the dev database password, non-HTTPS addresses, no SMTP or no Redis, and lists what to set | `apps/backend/app/preflight.py` |
| Schema changes | Alembic migrations with a baseline. Staging and production never alter tables on start-up | `apps/backend/migrations/`, `alembic.ini` |
| Deployment | Images for the API and web app, and a single-host stack with automatic HTTPS, PostgreSQL, Redis and a migration step | `apps/*/Dockerfile`, `infra/deploy/` |
| Continuous integration | API tests, migration check, web type-check, lint and build, desktop build and Rust checks on every push and pull request | `.github/workflows/ci.yml` |
| Accounts | E-mail verification, password reset, two-step verification with recovery codes, device list, rate limits, audit log | `apps/backend/app/services/accounts.py` |
| Patient rights | Download of the full record; self-service deletion of the account and all its data | `GET /patient/export`, `DELETE /auth/account` |
| Consent | A doctor sees only the areas a patient shared, only while the link is active; either side can end it | `apps/backend/app/services/care.py` |
| Browser hardening | Security headers on the API and the web app, HttpOnly session cookie, same-site redirects only | `security_headers.py`, `next.config.ts` |

### Releasing

```bash
cp infra/deploy/.env.example infra/deploy/.env        # fill in every value
docker compose -f infra/deploy/docker-compose.yml --env-file infra/deploy/.env up -d --build
```

- A database created before migrations existed (by the development start-up) must be marked
  once with `alembic stamp head`; after that, every release runs `alembic upgrade head`.
- After changing a model: `alembic revision --autogenerate -m "what changed"`, read the
  generated file, commit it. CI fails if models and migrations disagree.
- The first administrator: `python scripts/manage_users.py create --role admin --email ... --name ... --verified`
  inside the `api` container. Doctors are then verified at `/admin`.

## Blocking, and not solvable in code

1. **Regulatory status of the AI.** Software that flags findings on X-rays is a medical device
   in most markets (in India, under the Medical Devices Rules, 2017, licensed through CDSCO).
   Decide the intended use, the class and the market, and get the licence or a written opinion
   that one is not needed before any patient or doctor relies on a result. The disclaimers in
   the product do not replace this.
2. **A validated model.** The analyser registry is ready but no model shipped here has clinical
   validation evidence. Each model needs documented performance on data representative of
   your patients, a named owner, and a version recorded with every result. Today only the
   model's name is stored per study, not its version.
3. **Privacy law.** Health data is sensitive personal data (India: DPDP Act 2023; EU: GDPR;
   US: HIPAA if you work with covered entities). You need a privacy policy, terms of use,
   a consent notice at sign-up written by a lawyer, a named grievance or data-protection
   officer, a breach-notification procedure, and data-processing agreements with every vendor
   that touches records, including the hosting, e-mail and LLM providers behind the assistant.
4. **The patient assistant sends health questions to third-party LLM APIs** (Groq, xAI, Sarvam).
   The AI agents now ask each patient for consent before a model sees their record
   (`docs/AGENTS.md`), but the chat itself still sends every message to the chat provider. Both need
   a processing agreement with the provider, or must be switched off at launch
   (`AGENT_LLM_PROVIDER=off`, no chat service).
5. **Legal pages do not exist.** The sign-up form shows a short consent line and there are no
   `/privacy` or `/terms` pages. They were deliberately not drafted here.
6. **Doctor verification is a manual check** by an administrator against the medical council
   register. Write down who does it, how, and what evidence is kept.

## Needed before real traffic

- **Independent security test** of the API, web app and desktop app. Nothing here has been
  reviewed by anyone outside the project.
- **Backups.** The stack has none. Schedule encrypted PostgreSQL dumps and copies of the
  uploads volume to another location, and rehearse a restore.
- **Encryption at rest** for the database volume and the uploads volume (disk or provider level).
- **Monitoring and alerting:** uptime on `/api/v1/ready`, error tracking, alerts on failed
  e-mail (`/admin` shows the count) and on audit events with status `denied` or `failure`.
- **Imaging runs inside the web request.** One analysis occupies a worker for its whole
  duration, so a handful of simultaneous uploads will stall the API. Move analysis to a job
  queue before promoting the X-ray feature.
- **Uploads are stored on one host's disk.** More than one API host needs shared or object storage.
- **Desktop distribution:** code-signing certificates for Windows and macOS, and an update
  channel. Unsigned installers trigger operating-system warnings.
- **Clinical safety:** a way for a patient to report a problem, and a documented response when
  a vitals alert fires and no doctor reads it. The product tells patients to call 112; nobody
  is paged.

## AI agents

See `docs/AGENTS.md`. Before enabling them for real users:
- Have a clinician and a native speaker of each language review real outputs. The prompts pass
  `apps/agents/evals/run_live.py` on made-up cases, which is an engineering check, not a clinical one.
- Decide on `report_draft`: it puts AI-suggested text into a signed report (blocking item 1 applies).
- Fill in `AGENTS_LLM_NOTICE` with the provider and country patients' data would go to.

## Known product gaps

- Account security, care connections, notifications and the administration console are in
  English only; the rest of the patient portal has five languages.
- Clinician and staff accounts cannot be closed self-service (signed reports must be retained).
- Doctor notification e-mails link to web paths that only the desktop app understands.
- No payments, appointment calendar integration or video calling: a "video" consultation
  records a time and nothing more.
