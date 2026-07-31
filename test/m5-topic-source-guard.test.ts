/**
 * 주제 출처 가드 — ADR 0004 예외 경로의 3방향 검증 (M5 step-2).
 *
 * 이 가드가 느슨해지면 다음 오염을 아무도 못 잡는다. 그래서 "통과한다"만 보지 않고 **차단해야 할
 * 때 차단하는지**를 같은 무게로 본다:
 *   ① 승인 목록(digest 일치) 주제는 인정한다
 *   ② 목록에 손으로 한 줄 추가하면 `list_digest` 불일치로 거절한다
 *   ③ 규칙 파일이 바뀌면(또는 없으면) `rules_digest` 불일치로 거절한다
 */
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

import { loadApprovedTopics } from "../bench/check-no-new-topics.js";

type Topic = { topic_id: string; law: string; article_id: string };

/** 추출기와 동일한 digest 계산 — 어긋나면 계약이 깨진 것이다. */
function digestOf(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function fixture(topics: Topic[], opts: { rules?: string; breakList?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "m5-guard-"));
  const expansion = join(dir, "expansion");
  mkdirSync(expansion, { recursive: true });

  const rulesBody = opts.rules ?? JSON.stringify({ version: "test", quota_per_law: 5 });
  const rulesPath = join(expansion, "rules.approved.json");
  writeFileSync(rulesPath, rulesBody, "utf8");

  const listDigest = digestOf(JSON.stringify({ topics }, null, 2));
  const doc = {
    version: "test",
    rules_digest: digestOf(rulesBody),
    list_digest: listDigest,
    // breakList: digest 를 그대로 두고 목록만 손으로 늘린다 — 사람이 파일을 편집한 상황.
    topics: opts.breakList ? [...topics, { topic_id: "관세법 제1조", law: "관세법", article_id: "1" }] : topics,
  };
  writeFileSync(join(expansion, "topics-test.json"), JSON.stringify(doc, null, 2), "utf8");

  return {
    dirUrl: pathToFileURL(expansion + "/"),
    rulesUrl: pathToFileURL(rulesPath),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

const TOPICS: Topic[] = [
  { topic_id: "종합부동산세법 제8조", law: "종합부동산세법", article_id: "8" },
  { topic_id: "국세징수법 제57조", law: "국세징수법", article_id: "57" },
];

test("① digest 가 일치하면 승인 목록 주제를 인정한다", () => {
  const f = fixture(TOPICS);
  try {
    const r = loadApprovedTopics(f.dirUrl, f.rulesUrl);
    assert.equal(r.rejected, false);
    assert.equal(r.articles.size, 2);
    assert.ok(r.articles.has("종합부동산세법제8조"), "공백 정규화 후 조회되어야 한다");
  } finally {
    f.cleanup();
  }
});

test("② 목록에 손으로 한 줄 추가하면 list_digest 불일치로 거절한다", () => {
  const f = fixture(TOPICS, { breakList: true });
  try {
    const r = loadApprovedTopics(f.dirUrl, f.rulesUrl);
    assert.equal(r.rejected, true, "손으로 늘린 목록은 인정하면 안 된다");
    assert.equal(r.articles.size, 0, "거절된 목록의 주제는 하나도 인정하지 않는다");
    assert.ok(
      r.notes.some((n) => n.includes("list_digest 불일치")),
      `사유가 list_digest 로 나와야 한다: ${r.notes.join(" / ")}`,
    );
    // 밀어 넣으려던 주제가 통과하지 않았음을 직접 확인한다.
    assert.equal(r.articles.has("관세법제1조"), false);
  } finally {
    f.cleanup();
  }
});

test("③ 규칙 파일이 바뀌면 rules_digest 불일치로 거절한다", () => {
  // 목록은 규칙 A 의 digest 를 들고 있는데, 실제 규칙 파일은 B 다.
  const f = fixture(TOPICS);
  try {
    const other = fixture(TOPICS, { rules: JSON.stringify({ version: "tampered" }) });
    try {
      const r = loadApprovedTopics(f.dirUrl, other.rulesUrl);
      assert.equal(r.rejected, true);
      assert.ok(
        r.notes.some((n) => n.includes("rules_digest 불일치")),
        `사유가 rules_digest 로 나와야 한다: ${r.notes.join(" / ")}`,
      );
    } finally {
      other.cleanup();
    }
  } finally {
    f.cleanup();
  }
});

test("승인 목록이 없으면 예외 경로가 아예 적용되지 않는다(기존 동작 보존)", () => {
  const dir = mkdtempSync(join(tmpdir(), "m5-guard-empty-"));
  mkdirSync(join(dir, "expansion"), { recursive: true });
  try {
    const r = loadApprovedTopics(
      pathToFileURL(join(dir, "expansion") + "/"),
      pathToFileURL(join(dir, "expansion", "rules.approved.json")),
    );
    assert.equal(r.rejected, false);
    assert.equal(r.articles.size, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("실제 승인 목록(bench/expansion)이 digest 검증을 통과한다", () => {
  // 픽스처가 아니라 레포의 실물을 본다 — 추출기와 가드의 digest 계약이 실제로 맞물리는지.
  const r = loadApprovedTopics();
  assert.equal(r.rejected, false, `실물 목록이 거절됐다: ${r.notes.join(" / ")}`);
  assert.equal(r.articles.size, 60, "확장 주제 60종이 인정되어야 한다");
});
