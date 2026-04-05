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

export function assertLawApiKey(): void {
  if (!LAW_API_OC) {
    throw new Error("LAW_API_OC is missing. Set it in .env.");
  }
}
