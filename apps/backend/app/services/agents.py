"""
AI agents: the gateway between the product and the agents service (apps/agents).

Every run follows the same steps, in this order:

1. **Catalogue**: only agents listed in ``CATALOG`` exist, each for one audience (patient or doctor).
   ``AGENTS_DISABLED`` switches any of them off without a release.
2. **Permission**: the input is read here, through the same rules as the rest of the API: a
   patient's own record, or what a patient shared with this doctor over an active care link.
3. **Minimise**: names, contact details, dates of birth, free-text document titles and message
   bodies never leave this module. The agents service receives ages, readings, findings and the
   doctor's or patient's own words only where the task needs them.
4. **Consent**: an outside language model may see that data only if the patient the data is about
   allowed it (``users.ai_consent_at``). Without consent the agent still answers, from rules alone.
5. **Run**: the agents service computes the result (rules, then optionally the language model,
   then its safety check). Runs go to a small thread pool so a slow model never holds a request.
6. **Record**: the run, whether a model saw data, whether its text was withheld, and later what
   the person did with the result (accepted, edited, discarded) are stored in ``agent_runs``.

Nothing an agent produces is sent to another person automatically.
"""

from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import requests
import structlog
from sqlalchemy.orm import Session

from app.database.models.agents import AgentRun
from app.database.models.care import ConsultRequest
from app.database.models.doctor_panel import DoctorStudy
from app.database.models.iam import User
from app.database.models.patient_ehr import XrayStudy
from app.services import care
from app.services import doctor_panel as panel
from app.services import patient_ehr as ehr
from app.services.rbac import Role

logger = structlog.get_logger()

RUN_STALE_AFTER = timedelta(minutes=10)
MAX_FINAL_TEXT = 8000
REVIEW_DECISIONS = ("accepted", "edited", "discarded")
LANGUAGES = ("en", "hi", "bn", "ta", "te")


class AgentError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "agent_error"):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


@dataclass(frozen=True)
class AgentDef:
    key: str
    title: str
    audience: str  # "patient" or "doctor"
    description: str
    version: str


CATALOG: dict[str, AgentDef] = {
    a.key: a
    for a in (
        AgentDef(
            "report_explainer",
            "Explain my report",
            "patient",
            "Explains a report your doctor signed in plain words, lists the medical terms it uses and "
            "suggests questions to ask. It never adds anything the report doesn't say.",
            "1.0",
        ),
        AgentDef(
            "consult_brief",
            "Pre-consultation brief",
            "doctor",
            "One-screen summary of what the patient shared: what needs attention, vitals trends, "
            "medicines and adherence, imaging, and the reason for the visit.",
            "1.0",
        ),
        AgentDef(
            "report_draft",
            "Draft the impression",
            "doctor",
            "Turns the AI screen of a study into a draft impression with graded certainty, for you "
            "to edit. It is never signed or shared without you.",
            "1.0",
        ),
    )
}
# Not run through the gateway: the patient assistant reads the record through
# ``patient_context`` and is logged under this key.
RECORD_ASSISTANT = AgentDef(
    "record_assistant",
    "Health assistant: your record",
    "patient",
    "Lets the health assistant answer questions about your own readings, medicines, reports and appointments.",
    "1.0",
)


# --------------------------------------------------------------------------- settings


def _disabled() -> set[str]:
    return {k.strip() for k in os.getenv("AGENTS_DISABLED", "").split(",") if k.strip()}


DEV_AGENTS_URL = "http://127.0.0.1:8100"  # apps/agents/server.py on this machine


def agents_url() -> str | None:
    """Where the agents service is. In development it defaults to the local one, so the agents work
    as soon as `python server.py` is running; anywhere else it must be configured."""
    url = (os.getenv("AGENTS_URL") or "").strip().rstrip("/")
    if not url and os.getenv("FLASK_ENV", "development") == "development" and "AGENTS_URL" not in os.environ:
        return DEV_AGENTS_URL
    return url or None


def provider_notice() -> str:
    """Shown to patients when they decide on consent: who would see their data."""
    return os.getenv("AGENTS_LLM_NOTICE") or (
        "an external AI provider used by MIPAAS (currently Groq or xAI, depending on configuration)"
    )


def is_enabled(key: str) -> bool:
    return key not in _disabled() and (key == RECORD_ASSISTANT.key or agents_url() is not None)


def audience_of(user: User) -> str:
    role = user.role
    if role == Role.PATIENT.value:
        return "patient"
    if role in (Role.DOCTOR.value, Role.RADIOLOGIST.value):
        return "doctor"
    return "staff"


def catalog_for(user: User) -> list[dict]:
    audience = audience_of(user)
    items = [a for a in CATALOG.values() if a.audience == audience]
    if audience == "patient":
        items.insert(0, RECORD_ASSISTANT)
    return [
        {"key": a.key, "title": a.title, "description": a.description, "version": a.version, "enabled": is_enabled(a.key)}
        for a in items
    ]


# --------------------------------------------------------------------------- consent


def set_consent(db: Session, user: User, allow: bool) -> User:
    if user.role != Role.PATIENT.value:
        raise AgentError("Only patients decide on AI processing of their own record.", 403, "not_patient")
    user.ai_consent_at = datetime.now(UTC) if allow else None
    db.flush()
    return user


def consent_state(user: User) -> dict:
    at = user.ai_consent_at
    return {
        "consented": at is not None,
        "consented_at": at.isoformat() if at else None,
        "provider_notice": provider_notice(),
    }


def _consented(db: Session, patient_id: str | None) -> bool:
    if not patient_id:
        return False
    patient = db.get(User, patient_id)
    return bool(patient and patient.ai_consent_at)


# --------------------------------------------------------------------------- minimisation


def _profile_for_agents(profile: dict | None) -> dict | None:
    """Clinical background only: no date of birth, phone, emergency contact or language."""
    if not profile:
        return None
    return {k: profile.get(k) for k in ("age", "sex", "blood_group", "height_cm", "allergies", "conditions")}


def _log_for_agents(log: dict) -> dict:
    keep = (*ehr.LOG_METRICS, "log_date", "glucose_context", "symptoms")
    return {k: log.get(k) for k in keep}  # notes are free text: not sent


def _xray_for_agents(x: dict) -> dict:
    return {
        "date": x.get("taken_on") or (x.get("created_at") or "")[:10],
        "status": x.get("status"),
        "severity": x.get("severity"),
        "primary_finding": x.get("primary_finding"),
        "positive_findings": x.get("positive_findings") or [],
        "reviewed_by_you": bool(x.get("my_review")),
    }


def _findings_for_agents(findings: dict | None) -> dict | None:
    if not findings:
        return None
    return {
        "pathologies": [
            {k: p.get(k) for k in ("name", "probability", "threshold", "positive")}
            for p in findings.get("pathologies") or []
        ],
        "positive_findings": findings.get("positive_findings") or [],
    }


# --------------------------------------------------------------------------- inputs per agent


def _input_report_explainer(db: Session, user: User, params: dict) -> tuple[str | None, dict]:
    if user.role != Role.PATIENT.value:
        raise AgentError("This agent is for patients.", 403, "wrong_audience")
    study = panel.shared_report(db, user.id, str(params.get("report_id") or ""))  # 404 unless signed and shared
    detail = panel.serialize_for_patient(db, study, detail=True)
    language = params.get("language") if params.get("language") in LANGUAGES else "en"
    return user.id, {
        "language": language,
        "report": {
            "modality": detail.get("modality"),
            "analyzer_name": detail.get("analyzer_name"),
            "study_date": detail.get("study_date"),
            # The doctor's own signed words: the one free-text field the explainer needs.
            "impression": detail.get("impression") or "",
            "primary_finding": detail.get("primary_finding"),
            "severity": detail.get("severity"),
            "findings": _findings_for_agents(detail.get("findings")),
        },
    }


def _input_consult_brief(db: Session, user: User, params: dict) -> tuple[str | None, dict]:
    if audience_of(user) != "doctor":
        raise AgentError("This agent is for doctors.", 403, "wrong_audience")
    link = care.get_link(db, str(params.get("link_id") or ""), user.id)
    if link.doctor_id != user.id:
        raise AgentError("Not found.", 404, "NOT_FOUND")
    try:
        days = max(7, min(int(params.get("days") or 30), 366))
    except (TypeError, ValueError):
        days = 30
    record = care.shared_record(db, link, days=days)  # raises unless active; applies the patient's scopes
    payload: dict[str, Any] = {
        "days": days,
        "scopes": record["scopes"],
        "patient": {k: (record.get("patient") or {}).get(k) for k in ("age", "sex")},
    }
    if "profile" in record:
        payload["profile"] = _profile_for_agents(record["profile"])
    if "vitals" in record:
        v = record["vitals"]
        payload["vitals"] = {
            "latest": v.get("latest") or {},
            "logs": [_log_for_agents(x) for x in v.get("logs") or []],
            "streak_days": v.get("streak_days"),
        }
    if "medications" in record:
        m = record["medications"]
        payload["medications"] = {
            "items": [
                {k: i.get(k) for k in ("name", "dosage", "times", "is_active", "start_date", "end_date")}
                for i in m.get("items") or []
            ],
            "adherence_7d": m.get("adherence_7d"),
            "adherence_30d": m.get("adherence_30d"),
        }
    if "xrays" in record:
        payload["xrays"] = [_xray_for_agents(x) for x in record["xrays"]]
    if "documents" in record:
        # Titles and notes are free text the patient typed: only the category and the date go.
        payload["documents"] = [{"category": d.get("category"), "date": d.get("record_date")} for d in record["documents"]]
    consult_id = params.get("consult_id")
    if consult_id:
        consult = db.query(ConsultRequest).filter_by(id=str(consult_id), link_id=link.id).first()
        if consult is None:
            raise AgentError("Not found.", 404, "NOT_FOUND")
        payload["consult"] = {
            "reason": consult.reason,  # the patient wrote it for this doctor, about this visit
            "mode": consult.mode,
            "status": consult.status,
            "preferred_at": consult.preferred_at.isoformat() if consult.preferred_at else None,
            "scheduled_at": consult.scheduled_at.isoformat() if consult.scheduled_at else None,
        }
    payload["unread_messages"] = care.unread_for_link(db, link, user.id)
    return link.patient_id, payload


def _input_report_draft(db: Session, user: User, params: dict) -> tuple[str | None, dict]:
    if audience_of(user) != "doctor":
        raise AgentError("This agent is for doctors.", 403, "wrong_audience")
    study: DoctorStudy = panel.get_owned(db, user.id, str(params.get("study_id") or ""))
    if study.report_status == "signed":
        raise AgentError("This report is signed and can't be redrafted.", 409, "signed")
    detail = panel.serialize(study, detail=True)
    if detail.get("status") != "completed" or not detail.get("findings"):
        raise AgentError("There's no AI result to draft from yet. Run the analysis first.", 409, "no_result")
    return study.patient_user_id, {
        "study": {
            "modality": detail.get("modality"),
            "analyzer_name": detail.get("analyzer_name"),
            "severity": detail.get("severity"),
            "primary_finding": detail.get("primary_finding"),
            "model_name": detail.get("model_name"),
            "findings": _findings_for_agents(detail.get("findings")),
        },
        # Indication text stays here: it is free text that may name the patient.
    }


_BUILDERS = {
    "report_explainer": _input_report_explainer,
    "consult_brief": _input_consult_brief,
    "report_draft": _input_report_draft,
}


# --------------------------------------------------------------------------- run


def _serialize(run: AgentRun) -> dict:
    return {
        "id": run.id,
        "agent": run.agent,
        "version": run.version,
        "status": run.status,
        "output": json.loads(run.output_json) if run.output_json else None,
        "error": run.error,
        "llm_used": bool(run.llm_used),
        "guard": run.guard,
        "review_decision": run.review_decision,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "duration_ms": run.duration_ms,
    }


def serialize(run: AgentRun) -> dict:
    return _serialize(run)


def _call_agents_service(key: str, body: dict) -> dict:
    """POST the minimised input to the agents service. Replaced in tests."""
    url = agents_url()
    if not url:
        raise AgentError("AI agents aren't set up on this server.", 503, "agents_unavailable")
    headers = {}
    if os.getenv("AGENTS_SERVICE_KEY"):
        headers["X-Agents-Key"] = os.environ["AGENTS_SERVICE_KEY"]
    try:
        resp = requests.post(
            f"{url}/agents/{key}/run", json=body, headers=headers, timeout=float(os.getenv("AGENTS_TIMEOUT", "150"))
        )
    except requests.RequestException as exc:
        raise AgentError(
            "The AI agents service can't be reached right now."
            + (" Start it with: python apps/agents/server.py" if url == DEV_AGENTS_URL else ""),
            503,
            "agents_unreachable",
        ) from exc
    try:
        data = resp.json()
    except ValueError:
        data = {}
    if not resp.ok:
        raise AgentError(str(data.get("error") or f"agents service returned {resp.status_code}")[:300], 502, "agent_failed")
    return data.get("result") or {}


_EXECUTOR = ThreadPoolExecutor(max_workers=int(os.getenv("AGENTS_WORKERS", "4")), thread_name_prefix="agent")


def _execute(run_id: str, key: str, body: dict) -> None:
    from app.database.session import get_db

    started = time.monotonic()
    with get_db() as db:
        run = db.get(AgentRun, run_id)
        if run is None:
            return
        run.status = "running"
    try:
        result = _call_agents_service(key, body)
        status, error = "succeeded", None
    except AgentError as exc:
        result, status, error = None, "failed", exc.message
    except Exception as exc:  # pragma: no cover - defensive: a run must never stay "running"
        logger.error("agent_run_crashed", agent=key, error=str(exc))
        result, status, error = None, "failed", "The agent failed unexpectedly."
    with get_db() as db:
        run = db.get(AgentRun, run_id)
        if run is None:
            return
        run.status = status
        run.error = error
        run.duration_ms = int((time.monotonic() - started) * 1000)
        if result is not None:
            meta = result.pop("_meta", {}) if isinstance(result, dict) else {}
            run.output_json = json.dumps(result, ensure_ascii=False)
            run.llm_used = bool(meta.get("llm_used"))
            run.llm_model = (meta.get("llm_model") or None) and str(meta["llm_model"])[:80]
            run.guard = (meta.get("guard") or None) and str(meta["guard"])[:200]
    logger.info("agent_run_finished", agent=key, run_id=run_id, status=status)


def start(db: Session, user: User, key: str, params: dict, *, inline: bool = False) -> AgentRun:
    spec = CATALOG.get(key)
    if spec is None:
        raise AgentError("Unknown agent.", 404, "unknown_agent")
    if spec.audience != audience_of(user):
        raise AgentError("This agent isn't available for your account.", 403, "wrong_audience")
    if not is_enabled(key):
        raise AgentError("This agent is switched off right now.", 503, "agent_disabled")
    params = params if isinstance(params, dict) else {}
    subject_id, payload = _BUILDERS[key](db, user, params)
    llm_allowed = _consented(db, subject_id)

    run = AgentRun(
        agent=key,
        version=spec.version,
        actor_id=user.id,
        subject_id=subject_id,
        status="queued",
        params_json=json.dumps({k: params[k] for k in sorted(params) if k in ("report_id", "link_id", "consult_id", "study_id", "language", "days")}),
    )
    db.add(run)
    db.flush()
    body = {"input": payload, "llm_allowed": llm_allowed}
    if inline:
        db.commit()
        _execute(run.id, key, body)
        db.refresh(run)
    else:
        # The row must be committed before the worker looks for it.
        db.commit()
        _EXECUTOR.submit(_execute, run.id, key, body)
    return run


def get_run(db: Session, user: User, run_id: str) -> AgentRun:
    run = db.get(AgentRun, run_id)
    if run is None or run.actor_id != user.id:
        raise AgentError("Not found.", 404, "NOT_FOUND")
    created = run.created_at if run.created_at.tzinfo else run.created_at.replace(tzinfo=UTC)
    if run.status in ("queued", "running") and datetime.now(UTC) - created > RUN_STALE_AFTER:
        run.status, run.error = "failed", "The agent took too long and was stopped."
        db.flush()
    return run


def review(db: Session, user: User, run_id: str, decision: str, final_text: str | None) -> AgentRun:
    run = get_run(db, user, run_id)
    if decision not in REVIEW_DECISIONS:
        raise AgentError("decision must be accepted, edited or discarded.")
    if run.status != "succeeded":
        raise AgentError("Only a finished run can be reviewed.", 409, "not_finished")
    run.review_decision = decision
    run.reviewed_at = datetime.now(UTC)
    run.final_text = (final_text or "")[:MAX_FINAL_TEXT] or None if decision == "edited" else None
    db.flush()
    return run


# --------------------------------------------------------------------------- patient assistant

CONTEXT_SECTIONS = ("overview", "vitals", "medications", "reports", "consultations", "xrays")
CONTEXT_XRAYS = 5


def _patient_xray_for_assistant(db: Session, study: XrayStudy) -> dict:
    """One of the patient's own X-rays for the chat model. No title, file name or doctor's name: free text."""
    x = ehr.serialize_xray(study, detail=True)
    findings = x.get("findings") or {}
    return {
        "id": x["id"],
        "taken_on": x.get("taken_on"),
        "uploaded_at": x.get("created_at"),
        "status": x.get("status"),
        "severity": x.get("severity"),
        "primary_finding": x.get("primary_finding"),
        "flagged_findings": x.get("positive_findings") or [],
        "ai_summary": findings.get("clinical_summary"),
        "ai_disclaimer": findings.get("disclaimer"),
        "doctor_reviews": [
            {
                "date": (r.created_at.date().isoformat() if r.created_at else None),
                "impression": r.impression,
                "recommendation": r.recommendation,
                "urgency": r.urgency,
            }
            for r in care.reviews_for(db, "xray_study", study.id)
        ],
    }


def patient_context(db: Session, user: User, section: str, today) -> dict:
    """The patient's own record, minimised, for the health assistant. Requires consent: it goes to the chat model."""
    if user.role != Role.PATIENT.value:
        raise AgentError("This is for patient accounts.", 403, "not_patient")
    if not is_enabled(RECORD_ASSISTANT.key):
        raise AgentError("This agent is switched off right now.", 503, "agent_disabled")
    if not user.ai_consent_at:
        raise AgentError(
            "The patient hasn't allowed the assistant to read their record. They can turn it on under "
            "Account, then AI assistance.",
            409,
            "consent_required",
        )
    if section not in CONTEXT_SECTIONS:
        raise AgentError(f"section must be one of {', '.join(CONTEXT_SECTIONS)}.")

    out: dict[str, Any] = {"section": section, "today": today.isoformat()}
    if section == "overview":
        profile = ehr.get_or_create_profile(db, user.id)
        out["profile"] = _profile_for_agents(ehr.serialize_profile(profile))
        out["latest_readings"] = ehr.latest_readings(db, user.id)
        out["streak_days"] = ehr.logging_streak(db, user.id, today)
        out["adherence_7d"] = ehr.adherence(db, user.id, today, 7)
        out["doctors_connected"] = len(care.links_for(db, user.id, "patient", statuses=("active",)))
    elif section == "vitals":
        out["days"] = 30
        out["logs"] = [_log_for_agents(ehr.serialize_log(x)) for x in ehr.list_logs(db, user.id, 30, today)]
    elif section == "medications":
        out["today"] = [
            {"name": m["medication"]["name"], "dosage": m["medication"]["dosage"], "doses": m["doses"]}
            for m in ehr.medication_day(db, user.id, today)
        ]
        out["adherence_7d"] = ehr.adherence(db, user.id, today, 7)
        out["adherence_30d"] = ehr.adherence(db, user.id, today, 30)
    elif section == "reports":
        out["reports"] = [
            {
                **{k: r.get(k) for k in ("modality", "study_date", "primary_finding", "severity", "signed_at")},
                "impression": r.get("impression"),
            }
            for r in (panel.serialize_for_patient(db, s, detail=True) for s in panel.shared_reports(db, user.id)[:5])
        ]
    elif section == "consultations":
        out["consultations"] = [
            {k: c.get(k) for k in ("status", "mode", "reason", "preferred_at", "scheduled_at", "doctor_note")}
            for c in (care.serialize_consult(db, x, viewer="patient") for x in care.list_consults(db, user.id, "patient")[:10])
        ]
    elif section == "xrays":
        studies = (
            db.query(XrayStudy)
            .filter_by(user_id=user.id)
            .order_by(XrayStudy.created_at.desc())
            .limit(CONTEXT_XRAYS)
            .all()
        )
        out["xrays"] = [_patient_xray_for_assistant(db, s) for s in studies]

    db.add(
        AgentRun(
            agent=RECORD_ASSISTANT.key,
            version=RECORD_ASSISTANT.version,
            actor_id=user.id,
            subject_id=user.id,
            status="succeeded",
            params_json=json.dumps({"section": section}),
            llm_used=True,  # this data is for the chat model
        )
    )
    return out


# --------------------------------------------------------------------------- measurement


def stats(db: Session, days: int = 30) -> list[dict]:
    """Per agent: how often it ran, failed, used a model, was withheld, and what people did with it."""
    since = datetime.now(UTC) - timedelta(days=days)
    rows = db.query(AgentRun).filter(AgentRun.created_at >= since).all()
    out: dict[str, dict] = {}
    for key, spec in [(RECORD_ASSISTANT.key, RECORD_ASSISTANT), *CATALOG.items()]:
        out[key] = {
            "key": key,
            "title": spec.title,
            "audience": spec.audience,
            "enabled": is_enabled(key),
            "runs": 0,
            "failed": 0,
            "llm_used": 0,
            "withheld": 0,
            "accepted": 0,
            "edited": 0,
            "discarded": 0,
            "median_ms": None,
        }
    durations: dict[str, list[int]] = {}
    for r in rows:
        s = out.get(r.agent)
        if s is None:
            continue
        s["runs"] += 1
        s["failed"] += r.status == "failed"
        s["llm_used"] += bool(r.llm_used)
        s["withheld"] += bool(r.guard)
        if r.review_decision in REVIEW_DECISIONS:
            s[r.review_decision] += 1
        if r.duration_ms is not None:
            durations.setdefault(r.agent, []).append(r.duration_ms)
    for key, values in durations.items():
        values.sort()
        out[key]["median_ms"] = values[len(values) // 2]
    return list(out.values())
