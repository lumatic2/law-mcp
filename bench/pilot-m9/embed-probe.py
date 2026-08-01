"""M9 step-5: 세법 12종 조문 임베딩 검색의 상한과 손실축을 측정한다.

제품 코드는 바꾸지 않는다. scratchpad 조문 덤프를 읽어 로컬 SentenceTransformer 모델 두 종으로
동일한 조문 단위·query·k=3/10 검색을 수행하고 evidence JSON/Markdown 만 쓴다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import statistics
import time
from pathlib import Path
from typing import Any

import numpy as np
from huggingface_hub.constants import HF_HUB_CACHE
from sentence_transformers import SentenceTransformer


DEFAULT_MODELS = ["BAAI/bge-m3", "jhgan/ko-sroberta-multitask"]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def expected_key(expected: str) -> str:
    marker = expected.rfind(" 제")
    if marker < 0:
        raise ValueError(f"정답 표기를 못 갈랐다: {expected}")
    return f"{expected[:marker]}|{expected[marker + 1:]}"


def article_key(article: dict[str, Any]) -> str:
    return f"{article['law_name']}|{article['display']}"


def model_slug(model_name: str) -> str:
    return model_name.replace("/", "--")


def cached_revision(model_name: str) -> str | None:
    ref = Path(HF_HUB_CACHE) / f"models--{model_name.replace('/', '--')}" / "refs" / "main"
    return ref.read_text(encoding="utf-8").strip() if ref.exists() else None


def build_tasks() -> tuple[list[dict[str, str]], list[dict[str, str]], dict[str, Any]]:
    corpus = read_json(Path("bench/corpus.json"))
    dev = [
        {
            "case_id": item["case_id"],
            "query": item["query"],
            "expected": item["expected_article"],
        }
        for item in corpus["items"]
        if item.get("provenance") == "expansion-2026-08-01"
        and item.get("split") == "dev"
        and item.get("query")
        and item.get("expected_article")
    ]
    failures_doc = read_json(Path("evidence/bench/2026-08-01-m9-taxonomy/failures.json"))
    failure_a = [
        {"case_id": item["case_id"], "query": item["query"], "expected": item["expected_article"]}
        for item in failures_doc["cases"]
        if item["scope"] == "A"
    ]
    if len(dev) != 40 or len(failure_a) != 5:
        raise ValueError(f"분모 불일치: dev={len(dev)}, failure_A={len(failure_a)}")
    return dev, failure_a, failures_doc


def rank_rows(
    tasks: list[dict[str, str]],
    query_vectors: np.ndarray,
    article_vectors: np.ndarray,
    article_keys: list[str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for task, query_vector in zip(tasks, query_vectors, strict=True):
        scores = article_vectors @ query_vector
        order = np.argsort(-scores)
        wanted = expected_key(task["expected"])
        hit_positions = np.flatnonzero(np.asarray(article_keys, dtype=object)[order] == wanted)
        rank = int(hit_positions[0]) + 1 if len(hit_positions) else None
        rows.append(
            {
                **task,
                "rank": rank,
                "in_top3": rank is not None and rank <= 3,
                "in_top10": rank is not None and rank <= 10,
                "top10": [article_keys[int(index)].replace("|", " ") for index in order[:10]],
            }
        )
    return rows


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    top3 = sum(row["in_top3"] for row in rows)
    top10 = sum(row["in_top10"] for row in rows)
    return {
        "n": len(rows),
        "top3": top3,
        "top10": top10,
        "top3_rate": round(top3 / len(rows) * 100, 1),
        "top10_rate": round(top10 / len(rows) * 100, 1),
    }


def measure_model(
    model_name: str,
    articles: list[dict[str, Any]],
    dev: list[dict[str, str]],
    failure_a: list[dict[str, str]],
    baseline: dict[str, Any],
) -> dict[str, Any]:
    load_started = time.perf_counter()
    model = SentenceTransformer(model_name, device="cpu")
    model.max_seq_length = min(int(model.max_seq_length), 512)
    load_seconds = time.perf_counter() - load_started

    documents = [
        f"{item['law_name']} {item['display']} {item['title']}\n{item['text']}" for item in articles
    ]
    index_started = time.perf_counter()
    article_vectors = model.encode(
        documents,
        batch_size=4 if model_name == "BAAI/bge-m3" else 16,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True,
    ).astype(np.float32, copy=False)
    index_seconds = time.perf_counter() - index_started

    all_tasks = dev + failure_a
    latencies_ms: list[float] = []
    query_vectors_list: list[np.ndarray] = []
    for task in all_tasks:
        started = time.perf_counter()
        vector = model.encode(
            [task["query"]], normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False
        )[0].astype(np.float32, copy=False)
        latencies_ms.append((time.perf_counter() - started) * 1000)
        query_vectors_list.append(vector)
    query_vectors = np.stack(query_vectors_list)

    keys = [article_key(article) for article in articles]
    dev_rows = rank_rows(dev, query_vectors[: len(dev)], article_vectors, keys)
    failure_rows = rank_rows(failure_a, query_vectors[len(dev) :], article_vectors, keys)
    dev_by_id = {row["case_id"]: row for row in dev_rows}
    baseline_top3 = [row for row in baseline["rows"] if row["in_top3"]]
    baseline_top10 = [row for row in baseline["rows"] if row["in_top10"]]
    lost_top3 = [row["case_id"] for row in baseline_top3 if not dev_by_id[row["case_id"]]["in_top3"]]
    lost_top10 = [row["case_id"] for row in baseline_top10 if not dev_by_id[row["case_id"]]["in_top10"]]

    return {
        "model": model_name,
        "revision": cached_revision(model_name),
        "dimension": int(article_vectors.shape[1]),
        "max_seq_length": int(model.max_seq_length),
        "load_seconds": round(load_seconds, 3),
        "index_seconds": round(index_seconds, 3),
        "index_vectors_bytes": int(article_vectors.nbytes),
        "query_latency_ms": {
            "mean": round(statistics.mean(latencies_ms), 3),
            "median": round(statistics.median(latencies_ms), 3),
            "p95": round(float(np.percentile(latencies_ms, 95)), 3),
        },
        "dev": {"summary": summarize(dev_rows), "rows": dev_rows},
        "failure_A": {"summary": summarize(failure_rows), "rows": failure_rows},
        "loss": {
            "baseline_top3_n": len(baseline_top3),
            "missed_at_top3": len(lost_top3),
            "missed_top3_case_ids": lost_top3,
            "baseline_top10_n": len(baseline_top10),
            "missed_at_top10": len(lost_top10),
            "missed_top10_case_ids": lost_top10,
        },
    }


def summary_markdown(results: list[dict[str, Any]], dump_sha256: str) -> str:
    rows = []
    for result in results:
        dev = result["dev"]["summary"]
        gain = result["failure_A"]["summary"]
        loss = result["loss"]
        latency = result["query_latency_ms"]
        rows.append(
            f"| `{result['model']}` | {result['dimension']} | {result['max_seq_length']} | {dev['top3']}/40 | {dev['top10']}/40 | "
            f"{gain['top3']}/5 | {gain['top10']}/5 | {loss['missed_at_top3']}/{loss['baseline_top3_n']} | "
            f"{loss['missed_at_top10']}/{loss['baseline_top10_n']} | {result['index_seconds']:.1f}s | "
            f"{latency['median']:.1f}ms |"
        )
    return (
        "# M9 임베딩 상한 파일럿\n\n"
        "- 단위: 조문 · k=3/10 · 질의 필드 `query` · 세법 12종 실체 조문 1,804개\n"
        f"- 입력 덤프 SHA-256: `{dump_sha256}`\n"
        "- 문서 표현: `법령명 + 조문번호 + 표제 + 본문`; 모델 고유 상한을 존중하되 최대 512 토큰\n"
        "- **상한은 정답 조문이 후보 top-k에 포함되는 비율이며, 순위 통합·재정렬 후 실제 도달률이 아니다.**\n"
        "- 손실축: 현행 단발 기준선에서 맞힌 건을 같은 k의 임베딩 단독 검색이 놓친 수.\n\n"
        "| 모델 | 차원 | 실제 최대 토큰 | dev top-3 | dev top-10 | 실패 A top-3 | 실패 A top-10 | 현행 top-3 손실 | 현행 top-10 손실 | 색인 시간 | 질의 중앙값 |\n"
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n"
        + "\n".join(rows)
        + "\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dump",
        default=os.environ.get(
            "LAW_MCP_M9_SCRATCH", str(Path(os.environ["TEMP"]) / "law-mcp-m9-mapping-probe" / "articles.json")
        ),
    )
    parser.add_argument("--out", default="evidence/bench/2026-08-01-m9-embedding-pilot")
    parser.add_argument("--models", nargs="+", default=DEFAULT_MODELS)
    args = parser.parse_args()

    dump_path = Path(args.dump)
    dump_bytes = dump_path.read_bytes()
    dump = json.loads(dump_bytes)
    articles = dump["articles"]
    if len(dump["laws"]) != 12 or len(articles) != 1804:
        raise ValueError(f"인덱스 범위 불일치: laws={len(dump['laws'])}, articles={len(articles)}")
    dump_sha256 = hashlib.sha256(dump_bytes).hexdigest()
    dev, failure_a, _ = build_tasks()
    keys = {article_key(article) for article in articles}
    missing = sorted({expected_key(task["expected"]) for task in dev + failure_a} - keys)
    if missing:
        raise ValueError(f"정답 조문이 인덱스에 없음: {missing}")
    baseline = read_json(Path("evidence/bench/2026-08-01-m9-taxonomy/current-article-baseline.json"))

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for model_name in args.models:
        try:
            print(f"[{model_name}] 측정 시작", flush=True)
            result = measure_model(model_name, articles, dev, failure_a, baseline)
            results.append(result)
            (out_dir / f"{model_slug(model_name)}.json").write_text(
                json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            print(f"[{model_name}] 측정 완료", flush=True)
        except Exception as error:  # 실패 모델을 기록하고 다음 후보를 계속 잰다.
            errors.append({"model": model_name, "error": f"{type(error).__name__}: {error}"})
            print(f"[{model_name}] 실패: {type(error).__name__}: {error}", flush=True)

    (out_dir / "run-metadata.json").write_text(
        json.dumps(
            {
                "measured_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "dump_path": str(dump_path.resolve()),
                "dump_sha256": dump_sha256,
                "laws": len(dump["laws"]),
                "articles": len(articles),
                "dev": len(dev),
                "failure_A": len(failure_a),
                "models_requested": args.models,
                "models_completed": [result["model"] for result in results],
                "errors": errors,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (out_dir / "SUMMARY.md").write_text(summary_markdown(results, dump_sha256), encoding="utf-8")
    if len(results) < 2:
        raise RuntimeError(f"후보 모델 2종 비교 미달: 완료 {len(results)}, 실패 {errors}")


if __name__ == "__main__":
    main()
