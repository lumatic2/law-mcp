#!/usr/bin/env python3
import argparse
import json
import re
from datetime import datetime
from pathlib import Path


ARMS = ("codex-with", "codex-without", "opus-with", "opus-without")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    errors = []
    metas = {}
    raws = {}
    for arm in ARMS:
        directory = args.root / arm
        for name in ("run-meta.json", "raw.jsonl", "stderr.log", "answer.md"):
            if not (directory / name).exists():
                errors.append(f"{arm}: missing {name}")
        if any(not (directory / name).exists() for name in ("run-meta.json", "raw.jsonl", "answer.md")):
            continue
        meta = json.loads(read(directory / "run-meta.json"))
        raw = read(directory / "raw.jsonl")
        metas[arm], raws[arm] = meta, raw
        if meta["exit_code"] != 0:
            errors.append(f"{arm}: nonzero exit")
        if not read(directory / "answer.md").strip():
            errors.append(f"{arm}: empty answer")
        if arm.endswith("-with"):
            if "mcp__law_mcp__" not in raw and '"type":"mcp_tool_call"' not in raw:
                errors.append(f"{arm}: no law-mcp trace")
            if "INTERNAL_ERROR" in raw or "user cancelled MCP tool call" in raw:
                errors.append(f"{arm}: infrastructure-level law-mcp failure")
        else:
            if "mcp__law_mcp__" in raw or '"type":"mcp_tool_call"' in raw:
                errors.append(f"{arm}: MCP trace in minus arm")
        for marker in ('"name":"Bash"', '"name":"Read"', '"name":"Edit"', '"type":"command_execution"', '"type":"file_change"', '"web_search_requests":1', '"web_search_requests":2'):
            if marker in raw:
                errors.append(f"{arm}: forbidden marker {marker}")
        if arm.startswith("opus-") and not ('"model":"claude-opus-5"' in raw or '"canonicalModel":"claude-opus-5"' in raw):
            errors.append(f"{arm}: actual Opus model missing")
        if arm.startswith("codex-") and '"type":"turn.completed"' not in raw:
            errors.append(f"{arm}: incomplete Codex turn")
        if arm.startswith("opus-"):
            records = [json.loads(line) for line in raw.splitlines() if line.strip()]
            if not any(record.get("type") == "result" and record.get("is_error") is False for record in records):
                errors.append(f"{arm}: incomplete Opus result")

    if len(metas) == 4:
        starts = [iso(meta["started_at"]) for meta in metas.values()]
        spread = (max(starts) - min(starts)).total_seconds()
        if spread > 10:
            errors.append(f"start spread too large: {spread}s")
        if metas["codex-with"]["requested_model"] != metas["codex-without"]["requested_model"]:
            errors.append("Codex requested model mismatch")
        if metas["opus-with"]["requested_model"] != metas["opus-without"]["requested_model"]:
            errors.append("Opus requested model mismatch")
        if metas["codex-with"]["prompt_sha256"] != metas["opus-with"]["prompt_sha256"]:
            errors.append("plus prompt mismatch across models")
        if metas["codex-without"]["prompt_sha256"] != metas["opus-without"]["prompt_sha256"]:
            errors.append("minus prompt mismatch across models")
    else:
        spread = None

    result = {"gate": "PASS" if not errors else "FAIL", "start_spread_seconds": spread, "errors": errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
