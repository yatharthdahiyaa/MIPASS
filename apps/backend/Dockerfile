# MIPAAS API (Flask + gunicorn). Build context: apps/backend
#   docker build -t mipaas-api apps/backend
# Runtime data lives outside the image: mount /data (uploads) and /ml (model checkpoints).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10 \
    FLASK_ENV=production \
    PORT=8080 \
    MIPAAS_DATA_DIR=/data \
    MIPAAS_ML_DIR=/ml

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 mipaas \
    && mkdir -p /data /ml && chown mipaas:mipaas /data /ml

WORKDIR /app
COPY requirements.txt .
# CPU-only PyTorch: the image stays small and runs on any host. Use a CUDA base for GPU inference.
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY --chown=mipaas:mipaas app/ app/
COPY --chown=mipaas:mipaas config/ config/
COPY --chown=mipaas:mipaas migrations/ migrations/
COPY --chown=mipaas:mipaas scripts/ scripts/
COPY --chown=mipaas:mipaas alembic.ini wsgi.py ./

USER mipaas
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/v1/ready" || exit 1

# One model copy per worker: size WEB_CONCURRENCY to the memory available.
# The long timeout covers the first analysis after start-up, which loads the model.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} --workers ${WEB_CONCURRENCY:-2} --threads ${WEB_THREADS:-4} --timeout ${WEB_TIMEOUT:-180} --access-logfile - --error-logfile - wsgi:app"]
