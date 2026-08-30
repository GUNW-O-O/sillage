/// category 별 특화 필드. 스키마는 코드에 정의한다 (설계 4-3).
/// Product.attributes JSONB 에 그대로 들어간다 — 안의 lookup id 에는 FK 를 걸 수 없고
/// 무결성은 애플리케이션과 어드민 병합 로직이 진다.

export const ROAST_LEVELS = [
  { value: "LIGHT", label: "라이트" },
  { value: "MEDIUM_LIGHT", label: "미디엄 라이트" },
  { value: "MEDIUM", label: "미디엄" },
  { value: "MEDIUM_DARK", label: "미디엄 다크" },
  { value: "DARK", label: "다크" },
] as const;

export type RoastLevel = (typeof ROAST_LEVELS)[number]["value"];

export type CoffeeAttributes = {
  kind: "single" | "blend";
  varietyIds: string[];
  processId?: string;
  /// 가공방식과 분리한다 — 추천이 "가향으로 열대과일을 낸 원두"를 걸러내야 한다 (4-3)
  infused: boolean;
  roastLevel?: RoastLevel;
  agtron?: number;
  /// single 일 때
  countryId?: string;
  region?: string;
  farm?: string;
  producer?: string;
  lot?: string;
  /// blend 일 때. 국가만 복수로 받고 비율은 받지 않는다
  countryIds?: string[];
  /// 가공방식 축이 아니라 처리다. processId 가 단일 값이라 별도로 둔다
  decaf?: boolean;
};

export const EMPTY_COFFEE_ATTRIBUTES: CoffeeAttributes = {
  kind: "single",
  varietyIds: [],
  infused: false,
};

/// 빈 문자열 · 빈 배열 · false 를 걷어낸다. JSONB 에 의미 없는 키를 쌓지 않는다.
export function pruneAttributes(a: CoffeeAttributes): Record<string, unknown> {
  const out: Record<string, unknown> = { kind: a.kind, infused: a.infused };
  if (a.varietyIds.length > 0) out.varietyIds = a.varietyIds;
  if (a.processId) out.processId = a.processId;
  if (a.roastLevel) out.roastLevel = a.roastLevel;
  if (typeof a.agtron === "number" && !Number.isNaN(a.agtron)) out.agtron = a.agtron;
  if (a.decaf) out.decaf = true;

  if (a.kind === "single") {
    if (a.countryId) out.countryId = a.countryId;
    for (const k of ["region", "farm", "producer", "lot"] as const) {
      const v = a[k]?.trim();
      if (v) out[k] = v;
    }
  } else if (a.countryIds && a.countryIds.length > 0) {
    out.countryIds = a.countryIds;
  }
  return out;
}
