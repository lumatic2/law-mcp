#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--simulate-dispute-points", type=float, default=0.0)
    args = parser.parse_args()

    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    rubric = json.loads((ROOT / "rubric.json").read_text(encoding="utf-8"))
    errors = []

    for name, meta in manifest["files"].items():
        path = ROOT / name
        if not path.exists():
            errors.append(f"missing: {name}")
            continue
        if path.stat().st_size != meta["bytes"]:
            errors.append(f"size mismatch: {name}")
        expected = meta["sha256"]
        if expected != "TO_BE_FILLED_BY_FREEZE_VALIDATOR" and sha256(path) != expected:
            errors.append(f"sha256 mismatch: {name}")

    unit_total = sum(float(unit["weight"]) for unit in rubric["units"])
    confirmed = sum(float(unit["weight"]) for unit in rubric["units"] if unit["status"] == "confirmed")
    for unit in rubric["units"]:
        if abs(sum(unit["field_weights"].values()) - float(unit["weight"])) > 1e-9:
            errors.append(f"field weight mismatch: {unit['id']}")
    if unit_total != rubric["total_points"]:
        errors.append(f"unit total {unit_total} != {rubric['total_points']}")
    if confirmed != rubric["confirmed_points"]:
        errors.append(f"confirmed total {confirmed} != {rubric['confirmed_points']}")

    simulated_confirmed = confirmed - args.simulate_dispute_points
    ratio = simulated_confirmed / rubric["total_points"]
    gate_pass = ratio >= manifest["adjudication"]["minimum_ratio"]
    result = {
        "question_sha256": sha256(ROOT / "question.txt"),
        "rubric_sha256": sha256(ROOT / "rubric.json"),
        "unit_total": unit_total,
        "confirmed_points": simulated_confirmed,
        "confirmed_ratio": ratio,
        "minimum_ratio": manifest["adjudication"]["minimum_ratio"],
        "gate": "PASS" if gate_pass else "FAIL",
        "errors": errors,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors or not gate_pass else 0


if __name__ == "__main__":
    raise SystemExit(main())
