import assert from "node:assert/strict";
import test from "node:test";
import { bridgeTerm, formatBridgeWarning, TERM_BRIDGE_ENTRIES } from "../src/term-bridge.js";

test("bridgeTerm replaces a new-term query with the old term", () => {
  const result = bridgeTerm("기업업무추진비 한도 손금불산입");
  assert.ok(result);
  assert.equal(result?.from, "기업업무추진비");
  assert.equal(result?.to, "접대비");
  assert.equal(result?.direction, "new-to-old");
  assert.equal(result?.replaced, "접대비 한도 손금불산입");
});

test("bridgeTerm replaces an old-term query with the new term", () => {
  const result = bridgeTerm("접대비 한도");
  assert.ok(result);
  assert.equal(result?.from, "접대비");
  assert.equal(result?.to, "기업업무추진비");
  assert.equal(result?.direction, "old-to-new");
  assert.equal(result?.replaced, "기업업무추진비 한도");
});

test("bridgeTerm returns null when no dictionary term is present", () => {
  assert.equal(bridgeTerm("가지급금 대표이사 소득처분"), null);
});

test("bridgeTerm covers all seeded dictionary entries bidirectionally", () => {
  for (const entry of TERM_BRIDGE_ENTRIES) {
    const fromOld = bridgeTerm(entry.old);
    assert.equal(fromOld?.replaced, entry.new);
    const fromNew = bridgeTerm(entry.new);
    assert.equal(fromNew?.replaced, entry.old);
  }
});

test("formatBridgeWarning describes an old-to-new substitution", () => {
  const match = bridgeTerm("접대비 한도");
  assert.ok(match);
  const warning = formatBridgeWarning(match!, "접대비 한도");
  assert.equal(warning, "'접대비 한도' 0건 → 개정 후 용어 '기업업무추진비 한도'로 재검색");
});

test("formatBridgeWarning describes a new-to-old substitution", () => {
  const match = bridgeTerm("기업업무추진비 한도 손금불산입");
  assert.ok(match);
  const warning = formatBridgeWarning(match!, "기업업무추진비 한도 손금불산입");
  assert.equal(
    warning,
    "'기업업무추진비 한도 손금불산입' 0건 → 개정 전 용어 '접대비 한도 손금불산입'로 재검색",
  );
});
