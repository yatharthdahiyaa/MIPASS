# MIPAAS agents service (server.py: care agents, image upload/enhance, X-ray explanations, voice).
# Build context: apps/agents
#   docker build -t mipaas-agents apps/agents
# Callers must send X-Agents-Key: AGENTS_SERVICE_KEY. Without the variable the service refuses
# every call that doesn't come from inside the container.
# The patient chat (chat_server.py) is not part of this image yet; see docs/AGENTS.md.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10 \
    AGENTS_PORT=8100 \
    UPLOAD_AGENT_DIR=/data/uploads \
    VOICE_AGENT_DIR=/data/voice \
    MIPAAS_CXR_CHECKPOINT=/ml/chexpert_ensemble.pth

RUN apt-get update && apt-get install -y --no-install-recommends curl libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 mipaas \
    && mkdir -p /data /ml && chown mipaas:mipaas /data /ml

# Same depth as in the repository (apps/agents): the image agents find the repo root from their own path.
WORKDIR /srv/mipaas/apps/agents
COPY requirements.txt .
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt gunicorn

COPY --chown=mipaas:mipaas . .

USER mipaas
EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${AGENTS_PORT}/health" || exit 1
# Two workers: the image agents hold a model in memory each.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${AGENTS_PORT} --workers ${AGENTS_WORKERS:-2} --threads 4 --timeout 300 --access-logfile - --error-logfile - server:app"]
