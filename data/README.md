# data/

Local runtime data. Contents are git-ignored; only the folder skeleton is tracked.

| Folder | Purpose | Default consumer |
|---|---|---|
| `db/` | SQLite central database (`mipaas_central.db`); `archive/` holds the pre-consolidation copy | `app.paths.DEFAULT_DB_PATH` |
| `samples/` | Sample DICOM/images for tests and demos (`sample_cxr.dcm`) | `app.paths.SAMPLE_CXR_PATH` |
| `uploads/` | Local upload staging | `app.paths.UPLOADS_DIR` |
| `model_cache/` | Downloaded/cached model weights | `app.paths.MODEL_CACHE_DIR` |

Override the root with `MIPAAS_DATA_DIR`. Paths are defined in `apps/backend/app/paths.py`.
