"""
User administration CLI (run from apps/backend).

    python scripts/manage_users.py create --email a@b.c --name "Ada Lovelace" --role admin [--password ...]
    python scripts/manage_users.py list [--role doctor]
    python scripts/manage_users.py set-role --email a@b.c --role radiologist
    python scripts/manage_users.py set-password --email a@b.c            (prompts)
    python scripts/manage_users.py deactivate --email a@b.c
    python scripts/manage_users.py activate --email a@b.c
    python scripts/manage_users.py verify-email --email a@b.c           (mark the address confirmed)
    python scripts/manage_users.py pending-doctors
    python scripts/manage_users.py verify-doctor --email dr@clinic.org --by "Your name"
    python scripts/manage_users.py reject-doctor --email dr@clinic.org --by "Your name" --reason "..."
    python scripts/manage_users.py disable-mfa --email a@b.c            (support: lost authenticator)
    python scripts/manage_users.py outbox [--limit 10]                  (last e-mails, with links)

Every change is written to audit_logs with the operator name from --by or the OS user.
"""

import argparse
import getpass
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # apps/backend
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

from sqlalchemy import func  # noqa: E402

from app.database.models.iam import EmailOutbox, User  # noqa: E402
from app.database.session import get_db, init_db  # noqa: E402
from app.services import accounts  # noqa: E402
from app.services.rbac import Role  # noqa: E402


def _ctx(args) -> accounts.RequestContext:
    return accounts.RequestContext(ip="cli", user_agent=f"manage_users.py by {args.by}")


def _user(db, email: str) -> User:
    user = db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()
    if user is None:
        sys.exit(f"No account with e-mail {email}")
    return user


def _print_user(user: User, db=None) -> None:
    data = accounts.serialize_user(user, db)
    data["is_active"] = user.is_active
    print(json.dumps(data, indent=2, default=str))


def cmd_create(args):
    password = args.password or getpass.getpass("Password: ")
    with get_db() as db:
        user = accounts.create_account(
            db,
            name=args.name,
            email=args.email,
            password=password,
            organization=args.organization,
            role=Role(args.role),
            license_number=args.license,
            specialty=args.specialty,
        )
        if args.verified:
            user.email_verified_at = datetime.now(UTC)
        accounts.record_audit(db, "cli.user.create", _ctx(args), user=user)
        db.flush()
        _print_user(user, db)


def cmd_list(args):
    with get_db() as db:
        q = db.query(User).order_by(User.created_at)
        if args.role:
            q = q.filter(User.role == args.role)
        for u in q.all():
            flags = [
                "active" if u.is_active else "inactive",
                "email-verified" if u.email_verified_at else "email-unverified",
                "mfa" if u.is_mfa_enabled else "",
            ]
            print(f"{u.email:40} {u.role:16} {accounts.display_name(u):28} {' '.join(f for f in flags if f)}")


def cmd_set_role(args):
    with get_db() as db:
        user = _user(db, args.email)
        old = user.role
        user.role = Role(args.role).value
        accounts.revoke_all_sessions(db, user)
        accounts.record_audit(
            db, "cli.user.set_role", _ctx(args), user=user, details_json=json.dumps({"from": old, "to": user.role})
        )
        _print_user(user, db)


def cmd_set_password(args):
    password = args.password or getpass.getpass("New password: ")
    with get_db() as db:
        user = _user(db, args.email)
        accounts.set_password(user, password)
        accounts.revoke_all_sessions(db, user)
        accounts.record_audit(db, "cli.user.set_password", _ctx(args), user=user)
        print("Password updated; all sessions signed out.")


def cmd_active(args, active: bool):
    with get_db() as db:
        user = _user(db, args.email)
        user.is_active = active
        if not active:
            accounts.revoke_all_sessions(db, user)
        accounts.record_audit(db, "cli.user.activate" if active else "cli.user.deactivate", _ctx(args), user=user)
        _print_user(user, db)


def cmd_verify_email(args):
    with get_db() as db:
        user = _user(db, args.email)
        user.email_verified_at = user.email_verified_at or datetime.now(UTC)
        accounts.record_audit(db, "cli.user.verify_email", _ctx(args), user=user)
        print(f"{user.email} marked as verified.")


def cmd_pending_doctors(args):
    with get_db() as db:
        rows = accounts.pending_doctors(db)
        if not rows:
            print("No doctors are waiting for verification.")
        for user, profile in rows:
            status = "rejected" if profile.rejected_at else "pending"
            print(f"{user.email:40} {accounts.display_name(user):28} {profile.specialty:24} licence={profile.license_number} [{status}]")


def cmd_verify_doctor(args):
    with get_db() as db:
        user = _user(db, args.email)
        accounts.verify_doctor(db, user, by=args.by, note=args.note)
        accounts.record_audit(db, "cli.doctor.verify", _ctx(args), user=user)
        _print_user(user, db)


def cmd_reject_doctor(args):
    with get_db() as db:
        user = _user(db, args.email)
        accounts.reject_doctor(db, user, by=args.by, reason=args.reason)
        accounts.record_audit(db, "cli.doctor.reject", _ctx(args), user=user)
        _print_user(user, db)


def cmd_disable_mfa(args):
    with get_db() as db:
        user = _user(db, args.email)
        user.is_mfa_enabled = False
        user.mfa_enabled_at = None
        user.mfa_secret_enc = None
        accounts.revoke_all_sessions(db, user)
        accounts.record_audit(db, "cli.user.disable_mfa", _ctx(args), user=user)
        print(f"MFA disabled for {user.email}; all sessions signed out.")


def cmd_outbox(args):
    with get_db() as db:
        rows = db.query(EmailOutbox).order_by(EmailOutbox.created_at.desc()).limit(args.limit).all()
        for r in rows:
            print(f"--- {r.created_at:%Y-%m-%d %H:%M} [{r.status}] to {r.to_address}: {r.subject}")
            print(r.text_body)
            print()


def main():
    parser = argparse.ArgumentParser(description="MIPAAS user administration")
    parser.add_argument("--by", default=os.getenv("USERNAME") or os.getenv("USER") or "cli", help="operator name for the audit trail")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("create")
    p.add_argument("--email", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--role", required=True, choices=[r.value for r in Role])
    p.add_argument("--password")
    p.add_argument("--organization")
    p.add_argument("--license")
    p.add_argument("--specialty")
    p.add_argument("--verified", action="store_true", help="mark the e-mail address as confirmed")

    p = sub.add_parser("list")
    p.add_argument("--role")

    for name in ("set-role",):
        p = sub.add_parser(name)
        p.add_argument("--email", required=True)
        p.add_argument("--role", required=True, choices=[r.value for r in Role])

    p = sub.add_parser("set-password")
    p.add_argument("--email", required=True)
    p.add_argument("--password")

    for name in ("deactivate", "activate", "verify-email", "disable-mfa"):
        p = sub.add_parser(name)
        p.add_argument("--email", required=True)

    sub.add_parser("pending-doctors")

    p = sub.add_parser("verify-doctor")
    p.add_argument("--email", required=True)
    p.add_argument("--note")

    p = sub.add_parser("reject-doctor")
    p.add_argument("--email", required=True)
    p.add_argument("--reason", required=True)

    p = sub.add_parser("outbox")
    p.add_argument("--limit", type=int, default=10)

    args = parser.parse_args()
    init_db()
    {
        "create": cmd_create,
        "list": cmd_list,
        "set-role": cmd_set_role,
        "set-password": cmd_set_password,
        "deactivate": lambda a: cmd_active(a, False),
        "activate": lambda a: cmd_active(a, True),
        "verify-email": cmd_verify_email,
        "pending-doctors": cmd_pending_doctors,
        "verify-doctor": cmd_verify_doctor,
        "reject-doctor": cmd_reject_doctor,
        "disable-mfa": cmd_disable_mfa,
        "outbox": cmd_outbox,
    }[args.command](args)


if __name__ == "__main__":
    main()
