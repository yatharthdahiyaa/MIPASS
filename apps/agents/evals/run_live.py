"""Runs the care agents on the cases in cases.py with the REAL language model and scores them.

    python evals/run_live.py                 # all agents
    python evals/run_live.py explainer -v    # one agent, printing every output
    python evals/run_live.py --repeat 3      # each case three times (models vary between runs)

Uses the provider and key from apps/agents/.env. The cases are made up; nothing here is patient
data. A case passes when the model's text was shown (not withheld by the safety check, not
failed) and contains what the case requires. Exit code 1 if any case fails, so it can gate a
prompt change. Results are also written to evals/last_run.json.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(HERE.parent / ".env")

import cases  # noqa: E402
from CareAgents import consult_brief, llm, report_explainer  # noqa: E402


def _score(case: dict, text: str | None, meta: dict) -> tuple[bool, str]:
    if meta.get("llm_error"):
        return False, f"model call failed: {meta['llm_error']}"
    if meta.get("guard"):
        return False, f"withheld: {meta['guard']}"
    if not text:
        return False, "no model text"
    low = text.lower()
    for needle in case.get("must", []):
        if needle.lower() not in low:
            return False, f"missing {needle!r}"
    for needle in case.get("must_not", []):
        if needle.lower() in low:
            return False, f"contains {needle!r}"
    return True, "ok"


def run_explainer(case):
    out = report_explainer.run({"input": {"report": case["report"], "language": case.get("language", "en")}, "llm_allowed": True})
    return out.get("summary"), out


def run_brief(case):
    out = consult_brief.run({"input": case["input"], "llm_allowed": True})
    return out.get("narrative"), out


# report_draft uses no model (see its module docstring), so it has no live suite; its rules are
# covered by tests/test_care_agents.py.
SUITES = {"explainer": (cases.EXPLAINER, run_explainer), "brief": (cases.BRIEF, run_brief)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("suite", nargs="?", choices=[*SUITES, "all"], default="all")
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("--repeat", type=int, default=1)
    args = parser.parse_args()
    if not llm.available():
        print("No model configured: set the provider key in apps/agents/.env (and AGENT_LLM_PROVIDER is not 'off').")
        return 2
    print(f"model: {llm.model_name()}")

    results, failed = [], 0
    for name, (suite, fn) in SUITES.items():
        if args.suite not in ("all", name):
            continue
        for case in suite:
            for attempt in range(args.repeat):
                started = time.monotonic()
                text, out = fn(case)
                seconds = time.monotonic() - started
                ok, why = _score(case, text, out["_meta"])
                failed += not ok
                label = f"{name}/{case['name']}" + (f" #{attempt + 1}" if args.repeat > 1 else "")
                print(f"{'PASS' if ok else 'FAIL'}  {label:<42} {seconds:5.1f}s  {why}")
                if args.verbose or not ok:
                    print("      " + (text or "(no model text shown)").replace("\n", "\n      "))
                results.append({"case": label, "ok": ok, "why": why, "seconds": round(seconds, 1), "text": text, "meta": out["_meta"]})
    (HERE / "last_run.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{len(results) - failed}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
