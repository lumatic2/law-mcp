#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
from pathlib import Path


ARMS = ("codex-with", "codex-without", "opus-with", "opus-without")
LAW_TOOLS = [
    "search_law", "get_law_article", "search_precedents", "get_precedent",
    "search_admin_rules", "get_admin_rule", "batch_validate_legal_terms",
    "suggest_term_patches", "verify_citation", "search_legal_source", "get_legal_source",
]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = {"schema_version": 1, "arms": {}, "law_mcp_tool_allowlist": LAW_TOOLS}
    for arm in ARMS:
        directory = args.root / arm
        meta = json.loads(read(directory / "run-meta.json"))
        raw = read(directory / "raw.jsonl")
        models = sorted(set(re.findall(r'"model":"([^"]+)"', raw)))
        if not models:
            models = sorted(set(re.findall(r'"canonicalModel":"([^"]+)"', raw)))
        result["arms"][arm] = {
            **meta,
            "raw_sha256": sha(directory / "raw.jsonl"),
            "stderr_sha256": sha(directory / "stderr.log"),
            "answer_sha256": sha(directory / "answer.md") if (directory / "answer.md").exists() else None,
            "actual_models_in_trace": models,
            "actual_model_observability": "trace" if models else "Codex JSONL does not expose the resolved model; requested alias and CLI version are frozen",
            "law_mcp_call_count": len(re.findall(r'"type":"mcp_tool_call".*?"status":"completed"', raw)) + len(re.findall(r'"type":"tool_use".*?"name":"mcp__law_mcp__', raw)),
            "web_request_count": len(re.findall(r'"web_search_requests":([1-9][0-9]*)', raw)),
            "forbidden_tool_markers": [marker for marker in ("shell_command", "apply_patch", "browser", "chrome", "spawn_agent") if marker in raw],
        }
    target = args.output or args.root / "manifest.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
