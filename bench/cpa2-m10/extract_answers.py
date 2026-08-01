#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


ARMS = ("codex-with", "codex-without", "opus-with", "opus-without")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    for arm in ARMS:
        raw_path = args.root / arm / "raw.jsonl"
        records = [json.loads(line) for line in read(raw_path).splitlines() if line.strip()]
        answer = None
        if arm.startswith("codex-"):
            for record in records:
                item = record.get("item", {})
                if record.get("type") == "item.completed" and item.get("type") == "agent_message":
                    answer = item.get("text")
        else:
            for record in records:
                if record.get("type") == "result" and record.get("is_error") is False:
                    answer = record.get("result")
        if not answer:
            raise SystemExit(f"{arm}: final answer not found")
        (args.root / arm / "answer.md").write_text(answer.rstrip() + "\n", encoding="utf-8", newline="\n")
        print(f"{arm}: {len(answer)} chars")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
