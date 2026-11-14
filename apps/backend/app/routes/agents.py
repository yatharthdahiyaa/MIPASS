"""
AI agents (see app/services/agents.py for the rules every run follows).

    GET  /agents                         agents available to this account, with consent state for patients
    GET  /agents/consent                 PUT /agents/consent {allow}   patients: may an outside AI model see my record?
    POST /agents/<key>/runs              {params} -> 202 {run}; poll the run until it has finished
    GET  /agents/runs/<id>               the run (only the person who started it)
    POST /agents/runs/<id>/review        {decision: accepted|edited|discarded, final_text?}
    GET  /agents/context/patient         ?section=overview|vitals|medications|reports|consultations|xrays
                                         the patient's own record, minimised, for the health assistant

Admin: GET /admin/agents (per-agent counts) lives in admin.py.
"""

from functools import wraps

from flask import Blueprint, current_app, g, request

from app.database.models.iam import User
from app.database.session import get_db
from app.middleware.auth_middleware import get_authenticated_user
from app.services import agents
from app.services import patient_ehr as ehr
from app.services.security import LIMITS, get_rate_limiter
from app.utils.response import api_error, api_response

agents_bp = Blueprint("agents", __name__)


def signed_in(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if get_authenticated_user() is None:
            return api_error("Please sign in.", 401, "unauthenticated")
        try:
            return fn(*args, **kwargs)
        except agents.AgentError as exc:
            return api_error(exc.message, exc.status, exc.code)
        except ehr.EhrError as exc:  # includes care and doctor-panel errors (not found, not shared, ...)
            return api_error(exc.message, exc.status, exc.code)

    return wrapper


def _me(db) -> User:
    return db.get(User, g.current_user.id)


@agents_bp.route("/agents", methods=["GET"])
@signed_in
def list_agents():
    with get_db() as db:
        me = _me(db)
        out = {"agents": agents.catalog_for(me)}
        if agents.audience_of(me) == "patient":
            out["consent"] = agents.consent_state(me)
        return api_response(out)


@agents_bp.route("/agents/consent", methods=["GET"])
@signed_in
def get_consent():
    with get_db() as db:
        return api_response(agents.consent_state(_me(db)))


@agents_bp.route("/agents/consent", methods=["PUT"])
@signed_in
def put_consent():
    allow = bool((request.get_json(silent=True) or {}).get("allow"))
    with get_db() as db:
        me = agents.set_consent(db, _me(db), allow)
        from app.services import accounts

        accounts.record_audit(
            db,
            "agents.consent.grant" if allow else "agents.consent.withdraw",
            accounts.RequestContext(ip=request.remote_addr, user_agent=request.headers.get("User-Agent")),
            user=me,
            resource_type="consent",
        )
        return api_response(agents.consent_state(me))


@agents_bp.route("/agents/<key>/runs", methods=["POST"])
@signed_in
def start_run(key):
    if get_rate_limiter().hit("agent_run", g.current_user.id, LIMITS["agent_run"]):
        return api_error("You've used the AI agents a lot in the last hour. Try again later.", 429, "RATE_LIMITED")
    params = (request.get_json(silent=True) or {}).get("params") or {}
    with get_db() as db:
        run = agents.start(db, _me(db), key, params, inline=bool(current_app.config.get("AGENTS_INLINE")))
        return api_response({"run": agents.serialize(run)}, 202)


@agents_bp.route("/agents/runs/<run_id>", methods=["GET"])
@signed_in
def get_run(run_id):
    with get_db() as db:
        return api_response({"run": agents.serialize(agents.get_run(db, _me(db), run_id))})


@agents_bp.route("/agents/runs/<run_id>/review", methods=["POST"])
@signed_in
def review_run(run_id):
    data = request.get_json(silent=True) or {}
    with get_db() as db:
        run = agents.review(db, _me(db), run_id, str(data.get("decision") or ""), data.get("final_text"))
        return api_response({"run": agents.serialize(run)})


@agents_bp.route("/agents/context/patient", methods=["GET"])
@signed_in
def patient_context():
    today = ehr.parse_day_param(request.args.get("date"))
    with get_db() as db:
        return api_response(agents.patient_context(db, _me(db), request.args.get("section", "overview"), today))
