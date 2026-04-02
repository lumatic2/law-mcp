import axios from "axios";
import { evaluateLegalRuleIssues } from "./legal-rules.js";
import { getProfileRules } from "./legal-rules.js";
import { NIKL_API_KEY, NIKL_BASE_URL } from "./config.js";

export interface CustomReplacement {
  bad: string;
  good: string;
  reason: string;
}

export interface SuggestedPatch {
  before: string;
  after: string;
  reason: string;
  source: "rules" | "dictionary";
}

interface NiklSearchRow {
  word?: string;
}

interface NiklResponse {
  channel?: {
    item?: NiklSearchRow | NiklSearchRow[];
  };
}

function uniqueTerms(terms: string[]): string[] {
  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
}

function tokenizeText(text: string): string[] {
  const tokens = text.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
  return uniqueTerms(tokens);
}

function hasBatchim(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function hasRieulBatchim(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 === 8;
}

function pickParticle(lastChar: string, particle: string): string {
  const batchim = hasBatchim(lastChar);
  switch (particle) {
    case "은":
    case "는":
      return batchim ? "은" : "는";
    case "이":
    case "가":
      return batchim ? "이" : "가";
    case "을":
    case "를":
      return batchim ? "을" : "를";
    case "과":
    case "와":
      return batchim ? "과" : "와";
    case "으로":
    case "로":
      if (!batchim || hasRieulBatchim(lastChar)) return "로";
      return "으로";
    default:
      return particle;
  }
}

function polishKoreanParticles(text: string): string {
  return text.replace(/([가-힣]+)(은|는|이|가|을|를|과|와|으로|로)/g, (whole, word: string, particle: string) => {
    const lastChar = word[word.length - 1];
    if (!lastChar) return whole;
    const corrected = pickParticle(lastChar, particle);
    return `${word}${corrected}`;
  });
}

async function findDictionarySuggestion(term: string): Promise<string | null> {
  if (!NIKL_API_KEY) return null;

  const { data } = await axios.get<NiklResponse>(`${NIKL_BASE_URL}/search.do`, {
    params: {
      key: NIKL_API_KEY,
      q: term,
      req_type: "json",
      method: "include",
      num: 10,
      start: 1,
    },
    timeout: 15_000,
  });

  const raw = data.channel?.item;
  const rows = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const first = rows[0]?.word?.trim();
  if (!first) return null;
  if (first === term) return null;
  return first;
}

export async function suggestTermPatches(params: {
  text?: string;
  terms?: string[];
  profile: "legal" | "tax";
  customReplacements?: CustomReplacement[];
  includeDictionary?: boolean;
}): Promise<{
  terms: string[];
  patches: SuggestedPatch[];
  notes: string[];
  patched_text?: string;
  applied_patch_count?: number;
}> {
  const {
    text = "",
    terms = [],
    profile,
    customReplacements = [],
    includeDictionary = true,
  } = params;

  const baseTerms = terms.length > 0 ? uniqueTerms(terms) : tokenizeText(text);
  const patches: SuggestedPatch[] = [];
  const notes: string[] = [];

  const ruleIssues = evaluateLegalRuleIssues(baseTerms, profile, customReplacements);
  for (const issue of ruleIssues) {
    patches.push({
      before: issue.term,
      after: issue.suggested,
      reason: issue.reason,
      source: "rules",
    });
  }

  // Text-level detection: catch inflected surface forms like "절세팁에서는".
  const allRules = [...getProfileRules(profile), ...customReplacements];
  if (text) {
    for (const rule of allRules) {
      if (!rule.bad) continue;
      if (text.includes(rule.bad)) {
        patches.push({
          before: rule.bad,
          after: rule.good,
          reason: rule.reason,
          source: "rules",
        });
      }
    }
  }

  if (includeDictionary) {
    const dictionaryTerms = uniqueTerms(terms);
    if (dictionaryTerms.length === 0) {
      notes.push("terms 미지정으로 사전 기반 제안은 생략했습니다. 필요 시 terms를 함께 전달하세요.");
    }
    if (!NIKL_API_KEY) {
      notes.push("NIKL_API_KEY가 없어 사전 기반 제안은 건너뛰었습니다.");
    } else {
      for (const term of dictionaryTerms) {
        // Already patched by explicit rules; do not duplicate.
        if (patches.some((patch) => patch.before === term)) continue;
        const suggested = await findDictionarySuggestion(term);
        if (!suggested) continue;
        patches.push({
          before: term,
          after: suggested,
          reason: "사전 include 검색의 대표 표제어와 다릅니다.",
          source: "dictionary",
        });
      }
    }
  }

  // Deduplicate by (before, after)
  const dedup = new Map<string, SuggestedPatch>();
  for (const patch of patches) {
    dedup.set(`${patch.before}__${patch.after}`, patch);
  }

  const finalPatches = [...dedup.values()];
  let patchedText: string | undefined;
  let appliedPatchCount: number | undefined;

  if (text && finalPatches.length > 0) {
    // Replace longer terms first to avoid partial-overlap replacement.
    const ordered = [...finalPatches].sort((a, b) => b.before.length - a.before.length);
    let next = text;
    let count = 0;
    for (const patch of ordered) {
      if (!patch.before || patch.before === patch.after) continue;
      const replaced = next.split(patch.before).join(patch.after);
      if (replaced !== next) {
        count += 1;
        next = replaced;
      }
    }
    patchedText = polishKoreanParticles(next);
    appliedPatchCount = count;
  }

  return {
    terms: baseTerms,
    patches: finalPatches,
    notes,
    patched_text: patchedText,
    applied_patch_count: appliedPatchCount,
  };
}
