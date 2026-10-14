"""
Central Database CLI Initializer and Migrator.

Usage:
    python init_db.py [--drop] [--seed]
"""

import argparse
import json
import sys
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database.session import check_db_health, get_db_stats, init_db
from database.seed import seed_database


def main():
    parser = argparse.ArgumentParser(description="MiPAAS Central Database CLI")
    parser.add_argument("--drop", action="store_true", help="Drop all existing tables before creating")
    parser.add_argument("--seed", action="store_true", help="Run database seeding after initialization")
    parser.add_argument("--stats", action="store_true", help="Print table row counts and exit")
    parser.add_argument("--health", action="store_true", help="Run health check and exit")
    args = parser.parse_args()

    if args.health:
        print(json.dumps(check_db_health(), indent=2))
        return

    if args.stats:
        print(json.dumps(get_db_stats(), indent=2))
        return

    print("Initializing MiPAAS Central Database...")
    init_db(drop_first=args.drop)
    print("All 18 tables created successfully.")

    if args.seed:
        print("Seeding database with clinical baseline...")
        result = seed_database(overwrite=args.drop)
        print(json.dumps(result, indent=2))

    print("\nDatabase Status:")
    print(json.dumps(check_db_health(), indent=2))
    print("\nDatabase Table Stats:")
    print(json.dumps(get_db_stats(), indent=2))


if __name__ == "__main__":
    main()
