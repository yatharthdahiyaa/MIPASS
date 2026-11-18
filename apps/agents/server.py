"""MIPAAS agents server.

Run from this folder:
    python server.py

Settings come from the environment and from .env next to this file (see .env.example).

Callers must send X-Agents-Key: AGENTS_SERVICE_KEY. Without that variable the server accepts calls from
this machine only (development). /health is open.
"""

import hmac
import os
from pathlib import Path

# One OpenMP runtime per process: Anaconda's MKL (numpy/scipy) and the PyTorch wheel each ship
# libiomp5md.dll, and when both start Intel's runtime aborts the server (OMP Error #15).
# Sequential MKL never starts OpenMP. Must run before anything imports numpy.
os.environ.setdefault("MKL_THREADING_LAYER", "SEQUENTIAL")

from dotenv import load_dotenv  # noqa: E402
from flask import Flask, jsonify, request

# Before the agent imports: they read env vars at import time.
load_dotenv(Path(__file__).with_name(".env"))

from backend_client import BackendClient, BackendError  # noqa: E402
import CareAgents  # noqa: E402,F401  (registers report_explainer, consult_brief, report_draft)
from registry import AGENTS  # noqa: E402
from UploadAgent import upload_bp  # noqa: E402
from VoiceAgent import voice_bp  # noqa: E402
from XAI import xai_bp  # noqa: E402

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("UPLOAD_MAX_MB", "100")) * 1024 * 1024
app.register_blueprint(upload_bp)
app.register_blueprint(voice_bp)
app.register_blueprint(xai_bp)

SERVICE_KEY = os.getenv("AGENTS_SERVICE_KEY", "")
LOOPBACK = {"127.0.0.1", "::1"}


@app.before_request
def _authorise():
    """Only the MIPAAS backend, the chat service and the MCP server may call agents or read their files."""
    if request.path == "/health":
        return None
    if SERVICE_KEY:
        if hmac.compare_digest(request.headers.get("X-Agents-Key", ""), SERVICE_KEY):
            return None
        return jsonify(error="missing or wrong X-Agents-Key"), 401
    if request.remote_addr in LOOPBACK:
        return None
    return jsonify(error="set AGENTS_SERVICE_KEY to accept calls from other machines"), 403


def backend_for_request() -> BackendClient:
    """Forward the caller's bearer token so the backend applies their permissions."""
    auth = request.headers.get("Authorization", "")
    token = auth.removeprefix("Bearer ").strip() or None
    return BackendClient(token=token)


@app.get("/health")
def health():
    try:
        BackendClient().health()
        backend = "ok"
    except BackendError as exc:
        backend = str(exc)
    from CareAgents import llm

    return jsonify(status="ok", agents=len(AGENTS), backend=backend, llm=llm.available(), llm_model=llm.model_name())


@app.get("/agents")
def list_agents():
    return jsonify(agents=[a.to_dict() for a in AGENTS.values()])


@app.post("/agents/<key>/run")
def run_agent(key: str):
    spec = AGENTS.get(key)
    if spec is None:
        return jsonify(error=f"unknown agent '{key}'"), 404
    inputs = request.get_json(silent=True) or {}
    try:
        result = spec.fn(inputs, backend_for_request())
    except BackendError as exc:
        return jsonify(error=str(exc)), 502
    except (KeyError, ValueError) as exc:
        return jsonify(error=str(exc.args[0]) if exc.args else type(exc).__name__), 400
    except RuntimeError as exc:  # e.g. model weights missing or an API key not set
        return jsonify(error=str(exc)), 503
    return jsonify(agent=key, result=result)


if __name__ == "__main__":
    # Reloader off by default (FLASK_RELOAD=1 turns it on): a reload kills requests in flight, and
    # an X-ray explanation for the chatbot takes about 20 s.
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("AGENTS_PORT", "8100")),
        debug=True,
        threaded=True,
        use_reloader=os.getenv("FLASK_RELOAD", "0").lower() in ("1", "true", "yes"),
    )
