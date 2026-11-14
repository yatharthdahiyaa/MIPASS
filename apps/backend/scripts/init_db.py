"""
Central database CLI.

    python scripts/init_db.py            # create missing tables / columns
    python scripts/init_db.py --stats    # row counts
    python scripts/init_db.py --health   # connectivity
    python scripts/init_db.py --drop     # DESTRUCTIVE: drop every table first
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # apps/backend
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database.session import check_db_health, get_db_stats, init_db  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="MIPAAS central database CLI")
    parser.add_argument("--drop", action="store_true", help="Drop all tables before creating")
    parser.add_argument("--stats", action="store_true", help="Print table row counts and exit")
    parser.add_argument("--health", action="store_true", help="Run the health check and exit")
    args = parser.parse_args()

    if args.health:
        print(json.dumps(check_db_health(), indent=2))
        return
    if args.stats:
        print(json.dumps(get_db_stats(), indent=2))
        return
    if args.drop and input("Type DROP to drop every table: ") != "DROP":
        print("Aborted.")
        return

    init_db(drop_first=args.drop)
    stats = get_db_stats()
    print(f"Database ready: {stats['total_tables']} tables at {stats['database_url']}")


if __name__ == "__main__":
    main()
