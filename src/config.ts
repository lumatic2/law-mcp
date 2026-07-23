import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, "../.env"), quiet: true });
config({ quiet: true });

export const LAW_API_KEY = process.env.LAW_API_KEY ?? "";
export const LAW_API_OC = process.env.LAW_API_OC ?? process.env.LAW_API_KEY ?? "";
export const LAW_SEARCH_BASE_URL =
  process.env.LAW_SEARCH_BASE_URL ?? "https://www.law.go.kr/DRF/lawSearch.do";
export const LAW_SERVICE_BASE_URL =
  process.env.LAW_SERVICE_BASE_URL ?? "https://www.law.go.kr/DRF/lawService.do";
export const NIKL_API_KEY = process.env.NIKL_API_KEY ?? process.env.KOREANDICT_API_KEY ?? "";
export const NIKL_BASE_URL = process.env.NIKL_BASE_URL ?? "https://stdict.korean.go.kr/api";

/**
 * 인증값이 없을 때 **사람이 읽는** 안내를 던진다.
 *
 * 구 문구는 "LAW_API_OC is missing. Set it in .env." 한 줄이었다. 이건 이미 사정을 아는
 * 사람에게만 통한다 — 처음 붙이는 사람은 그 값이 무엇인지, 어디서 받는지 모른다. 상류(법제처)도
 * 절차를 공개하지 않으므로 검색해도 안 나온다. 그래서 ① 무엇이 없는지 ② 어디서 받는지(URL)
 * ③ 어디에 넣는지를 이 자리에서 전부 말한다.
 */
export const OC_ISSUE_URL = "https://open.law.go.kr/LSO/openApi/cuAskList.do";
export const OC_MANAGE_URL = "https://open.law.go.kr/LSO/usr/usrOcInfoMod.do";

export function missingCredentialMessage(): string {
  return [
    "법제처 OpenAPI 인증값(LAW_API_OC)이 없습니다 — 이 서버의 도구 11개 중 9개가 동작하지 않습니다.",
    "",
    "1. 발급 신청: " + OC_ISSUE_URL + " (메일주소로 회원가입·로그인한 뒤 신청)",
    "2. 발급된 값 확인: " + OC_MANAGE_URL,
    "3. 그 값을 .env 의 LAW_API_OC 에 넣거나, MCP 설정의 env 로 전달하세요.",
    "",
    "인증값은 사용자가 직접 발급받아야 하며 이 서버가 대신 발급할 수 없습니다.",
  ].join("\n");
}

export function assertLawApiKey(): void {
  if (!LAW_API_OC) {
    throw new Error(missingCredentialMessage());
  }
}
