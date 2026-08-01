#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNS = ROOT / "evidence" / "cpa2" / "2026-m10" / "runs"
OUT = ROOT / "evidence" / "cpa2" / "2026-m10" / "scoring" / "blind"


def main() -> int:
    entries = []
    for directory in RUNS.iterdir():
        answer = directory / "answer.md"
        if answer.exists():
            digest = hashlib.sha256(answer.read_bytes()).hexdigest()
            entries.append((digest, directory.name, answer))
    entries.sort()
    OUT.mkdir(parents=True, exist_ok=True)
    mapping = {}
    for index, (digest, arm, answer) in enumerate(entries):
        blind_id = chr(ord("A") + index)
        (OUT / f"{blind_id}.md").write_bytes(answer.read_bytes())
        mapping[blind_id] = {"arm": arm, "answer_sha256": digest}
    (OUT.parent / "mapping.json").write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"created {len(entries)} blinded answers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
