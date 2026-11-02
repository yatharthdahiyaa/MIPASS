# Project Structure

```
.
├── apps/
│   ├── backend/        Flask API, agents, workers, tests        (Python)
│   ├── frontend/       Next.js web app                           (TypeScript)
│   └── iam-rbac/       Standalone IAM / RBAC service + admin UI  (Node)
├── data/               Local runtime data (git-ignored contents)
│   ├── db/             SQLite database (+ archive/ of the pre-consolidation copy)
│   ├── samples/        Sample DICOM files for tests / demos
│   ├── uploads/        Local upload staging
│   └── model_cache/    Cached model weights
├── ml/                 Model source repos + trained checkpoints (git-ignored)
├── infra/database/     schema.sql, standalone Postgres compose, DB guide
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
| `DATABASE_URL` | unset -> SQLite at `data/db/mipaas_central.db` |

## Frontend (`apps/frontend/src`)

| Path | Role |
|---|---|
| `app/` | Next.js routes (pages are thin wrappers) |
| `portals/{admin,doctor,openemr}/` | Portal implementations, one folder per portal |
| `components/` | Shared / marketing / product components (no portal code) |
| `config/api.ts` | Backend and IAM origins + `/api/v1` prefix; mirrored by `next.config.ts` rewrites |
| `services/`, `context/`, `types/` | API clients, React context, shared types |

Env: `NEXT_PUBLIC_API_ORIGIN` (default `http://localhost:8080`), `NEXT_PUBLIC_IAM_ORIGIN` (default `http://localhost:5000`).
