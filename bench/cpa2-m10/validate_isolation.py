#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EXPECTED_DEPLOY = Path("C:/Users/yusun/projects/custom-mcps/law-mcp/dist/index.js")
SOURCE_DIST = ROOT / "dist" / "index.js"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def raw_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke-root", type=Path)
    parser.add_argument("--probe-bad-entry", action="store_true")
    parser.add_argument("--probe-minus-mcp", action="store_true")
    args = parser.parse_args()
    errors = []

    if args.probe_bad_entry:
        errors.append("deployed entry mismatch")
    elif not EXPECTED_DEPLOY.exists() or sha(EXPECTED_DEPLOY) != sha(SOURCE_DIST):
        errors.append("deployed entry mismatch")

    if args.probe_minus_mcp:
        errors.append("minus arm contains MCP configuration")

    if args.smoke_root:
        for arm in ("codex-with", "codex-without", "opus-with", "opus-without"):
            arm_dir = args.smoke_root / arm
            meta_path = arm_dir / "run-meta.json"
            raw_path = arm_dir / "raw.jsonl"
            if not meta_path.exists() or not raw_path.exists():
                errors.append(f"{arm}: missing smoke output")
                continue
            meta = json.loads(raw_text(meta_path))
            raw = raw_text(raw_path)
            if meta["exit_code"] != 0:
                errors.append(f"{arm}: nonzero exit")
            if arm.endswith("-with"):
                if not any(marker in raw for marker in ("get_law_article", "mcp__law_mcp__get_law_article")):
                    errors.append(f"{arm}: no law-mcp call trace")
                if "기타소득" not in raw:
                    errors.append(f"{arm}: no article result")
                if any(marker in raw for marker in ("user cancelled MCP tool call", '"is_error":true', "INTERNAL_ERROR")):
                    errors.append(f"{arm}: law-mcp call failed")
            else:
                if "NO_TOOL_AVAILABLE" not in raw:
                    errors.append(f"{arm}: minus sentinel missing")
                if "mcp__law_mcp" in raw or "get_law_article" in raw:
                    errors.append(f"{arm}: MCP trace present")

    result = {"gate": "PASS" if not errors else "FAIL", "errors": errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
