import { ROAST_LEVELS } from "./product-attributes";

/// attributes JSONB 안의 lookup id 를 사람이 읽는 라벨로 바꾼다.
/// 거기엔 FK 를 걸 수 없어(설계 4-3) 조인이 안 되므로 id 를 모아 따로 읽고 여기서 합친다.
export function collectLookupIds(attributes: unknown): string[] {
  const a = (attributes ?? {}) as Record<string, unknown>;
  const ids: string[] = [];
  for (const key of ["countryId", "processId"]) {
    if (typeof a[key] === "string") ids.push(a[key] as string);
  }
  for (const key of ["countryIds", "processIds", "varietyIds"]) {
    const list = a[key];
    if (Array.isArray(list)) ids.push(...list.filter((v): v is string => typeof v === "string"));
  }
  return [...new Set(ids)];
}

export type DisplayField = { label: string; value: string };

/// 값이 있는 것만 돌려준다. 빈 칸을 "—" 로 늘어놓으면 공개 수준이 낮은 원두일수록
/// 화면이 결함처럼 보인다 — 로스터리마다 공개 수준이 다른 것이 정상이다 (설계 4-3).
export function describeProduct(
  attributes: unknown,
  names: Map<string, string>,
): DisplayField[] {
  const a = (attributes ?? {}) as Record<string, unknown>;
  const out: DisplayField[] = [];
  const name = (id: unknown) => (typeof id === "string" ? (names.get(id) ?? null) : null);
  const list = (v: unknown) =>
    Array.isArray(v) ? v.map(name).filter(Boolean).join(" · ") : "";

  const blend = a.kind === "blend";
  out.push({ label: "구성", value: blend ? "블렌드" : "싱글 오리진" });

  const country = blend ? list(a.countryIds) : name(a.countryId);
  if (country) out.push({ label: "나라", value: country });
  if (typeof a.region === "string" && a.region) out.push({ label: "지역", value: a.region });

  const process = blend ? list(a.processIds) : name(a.processId);
  if (process) out.push({ label: "가공", value: process });

  const varieties = list(a.varietyIds);
  if (varieties) out.push({ label: "품종", value: varieties });

  const roast = ROAST_LEVELS.find((r) => r.value === a.roastLevel);
  if (roast) out.push({ label: "배전도", value: roast.label });
  if (typeof a.agtron === "number") out.push({ label: "아그트론", value: String(a.agtron) });

  for (const [key, label] of [
    ["farm", "농장"],
    ["producer", "프로듀서"],
    ["lot", "로트"],
  ] as const) {
    if (typeof a[key] === "string" && a[key]) out.push({ label, value: a[key] as string });
  }

  if (a.infused === true) out.push({ label: "가향", value: "예" });
  if (a.decaf === true) out.push({ label: "디카페인", value: "예" });

  return out;
}
