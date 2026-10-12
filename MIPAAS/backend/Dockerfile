# ──────────────────────────────────────────────
# MIPAAS API Gateway — Dockerfile
# Multi-stage build for Flask API (no GPU needed)
# ──────────────────────────────────────────────

FROM python:3.11-slim AS base

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/
COPY config/ config/
COPY models/ models/
COPY workers/ workers/

# Environment
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/v1/health || exit 1

# Run with Gunicorn
EXPOSE ${PORT}
CMD exec gunicorn \
    --bind :${PORT} \
    --workers 4 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    "app:create_app()"
