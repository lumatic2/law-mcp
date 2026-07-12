/**
 * 세법 신·구 용어 브리지 — 법령 개정으로 명칭이 바뀐 용어의 양방향 매핑.
 *
 * 배경: 판례 색인 등 검색 대상이 선고 당시 용어(구용어)에 묶여 있으면, 현행 법령 용어(신용어)로
 * 검색해도 0건이 나올 수 있다(BACKLOG Issue-back #5: "기업업무추진비" 0건 vs "접대비" 3건).
 * 이 사전은 그런 경우 쿼리 내 등재 용어를 대응 용어로 1회 치환해 재검색하는 데 쓴다
 * (kifrs-rag term_bridge 동형).
 *
 * 신뢰도 원칙: 여기 등재하는 항목은 "동일 개념의 순수 명칭 변경"만 다룬다. 개념이 재구성되거나
 * 병합·분리된 경우(예: 가산금 제도 개편)는 오검색 위험이 커 등재하지 않는다. 불확실한 항목을
 * 추가하지 않는다 — 잘못된 매핑이 매핑이 없는 것보다 해롭다.
 */

export interface TermBridgeEntry {
  /** 구용어 (개정 전) */
  readonly old: string;
  /** 신용어 (개정 후) */
  readonly new: string;
  /** 근거: 개정 법령·시행일 */
  readonly basis: string;
}

export const TERM_BRIDGE_ENTRIES: readonly TermBridgeEntry[] = [
  {
    old: "접대비",
    new: "기업업무추진비",
    basis: "법인세법 등 2021.12.21 개정, 2022.1.1 시행 — '접대비'를 '기업업무추진비'로 명칭 변경",
  },
  {
    old: "법정기부금",
    new: "특례기부금",
    basis: "법인세법 2020년 개정, 2021.1.1 시행 — 기부금 구분 중 '법정기부금'을 '특례기부금'으로 명칭 변경",
  },
  {
    old: "지정기부금",
    new: "일반기부금",
    basis: "법인세법 2020년 개정, 2021.1.1 시행 — 기부금 구분 중 '지정기부금'을 '일반기부금'으로 명칭 변경",
  },
];

export type BridgeDirection = "old-to-new" | "new-to-old";

export interface TermBridgeMatch {
  /** 치환 적용된 전체 쿼리 문자열 */
  replaced: string;
  /** 원 쿼리에서 매치된 용어 */
  from: string;
  /** 치환된 대응 용어 */
  to: string;
  direction: BridgeDirection;
}

/**
 * 쿼리 문자열에서 사전에 등재된 용어를 찾아 대응 용어로 1회 치환한다.
 * - 구용어가 있으면 신용어로, 신용어가 있으면 구용어로 치환한다(등재 순서 첫 매치 1건만 — 과설계 방지).
 * - 매치가 없으면 null.
 */
export function bridgeTerm(query: string): TermBridgeMatch | null {
  for (const entry of TERM_BRIDGE_ENTRIES) {
    if (query.includes(entry.old)) {
      return {
        replaced: query.split(entry.old).join(entry.new),
        from: entry.old,
        to: entry.new,
        direction: "old-to-new",
      };
    }
    if (query.includes(entry.new)) {
      return {
        replaced: query.split(entry.new).join(entry.old),
        from: entry.new,
        to: entry.old,
        direction: "new-to-old",
      };
    }
  }
  return null;
}

/**
 * bridgeTerm 매치 결과를 도구 warning 문구로 포맷한다.
 * 예: "'기업업무추진비 한도' 0건 → 개정 전 용어 '접대비 한도'로 재검색"
 */
export function formatBridgeWarning(match: TermBridgeMatch, originalQuery: string): string {
  const label = match.direction === "old-to-new" ? "개정 후" : "개정 전";
  return `'${originalQuery}' 0건 → ${label} 용어 '${match.replaced}'로 재검색`;
}
