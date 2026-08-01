#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUESTION = ROOT / "evidence" / "cpa2" / "2026-m10" / "frozen" / "question.txt"
OUT = Path(__file__).resolve().parent / "generated"

SYSTEM = """당신은 대한민국 공인회계사 제2차시험 세법 답안을 작성하는 독립 응시자다.
외부 웹, 브라우저, 셸, 파일 읽기, 다른 에이전트, 스킬, 해설 또는 채점표를 사용하지 마라.
문제에 명시된 2026년 귀속과 시험일 2026-06-27 현재 법령을 적용하라.
각 요구사항을 빠짐없이 답하고, 계산식과 법적 처리 근거를 함께 적어라.
존재를 확인하지 못한 조문 번호를 추측하거나 만들어내지 마라.
최종 답안은 한국어 Markdown으로만 작성하라."""

TOOL_SENTENCE = {
    "with": "사용 가능한 외부 도구는 law-mcp뿐이다. 법적 결론마다 law-mcp로 시험일 현재 조문 본문을 확인하고 근거를 제시하라.",
    "without": "사용 가능한 외부 도구는 없다. 자신의 지식으로 풀되, 불확실한 조문 번호는 쓰지 말고 법적 취지만 설명하라.",
}

SMOKE = {
    "with": "law-mcp의 get_law_article을 실제로 한 번 호출하여 2026-06-27 현재 소득세법 제21조의 조문 제목만 답하라.",
    "without": "외부 도구를 호출하지 말고 정확히 NO_TOOL_AVAILABLE 한 줄만 답하라.",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["smoke", "solve"], required=True)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    common = SYSTEM if args.mode == "smoke" else SYSTEM + "\n\n" + QUESTION.read_text(encoding="utf-8")
    records = {}
    for availability in ("with", "without"):
        task = SMOKE[availability] if args.mode == "smoke" else "위 문제를 지금 풀어라."
        text = common + "\n\n" + TOOL_SENTENCE[availability] + "\n\n" + task + "\n"
        path = OUT / f"{args.mode}-{availability}.txt"
        path.write_text(text, encoding="utf-8", newline="\n")
        records[availability] = {"path": str(path), "sha256": digest(path.read_bytes()), "bytes": path.stat().st_size}
    common_path = OUT / f"{args.mode}-common.txt"
    common_path.write_text(common + "\n", encoding="utf-8", newline="\n")
    result = {"mode": args.mode, "common_sha256": digest(common_path.read_bytes()), "prompts": records}
    (OUT / f"{args.mode}-manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
