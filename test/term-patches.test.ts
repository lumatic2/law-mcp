import assert from "node:assert/strict";
import test from "node:test";
import { suggestTermPatches } from "../src/term-patches.js";

test("suggestTermPatches returns patched_text with particle polishing", async () => {
  const result = await suggestTermPatches({
    text: "세금폭탄을 줄이는 절세팁",
    profile: "tax",
    includeDictionary: false,
  });

  assert.ok(result.patched_text);
  assert.match(result.patched_text ?? "", /세부담 증가를/);
  assert.ok((result.applied_patch_count ?? 0) >= 1);
});
