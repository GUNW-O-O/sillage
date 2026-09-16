import { normalizeName } from "./normalize";

/// 노트 하나가 실제로 칠해질 색을 정한다 (설계 2026-09-08 §6).
///
/// ```
/// 별칭의 색  ??  L2 의 색  ??  L1 의 색  ??  null (띠에서 뺀다)
/// ```
///
/// **어느 단에서든 덮어쓰고, 안 덮으면 위에서 물려받는다.** 표현마다 색을 정하는 것이
/// 아니라 축 색이 안 맞는 표현만 덮는 구조라, 별칭 대부분은 `color` 가 null 이다.
///
/// **`SellerNote` 에서 `NoteAlias` 로 가는 FK 가 없다.** `raw` 문자열뿐이고
/// `normalizedRaw` 도 없어서 SQL 조인으로는 못 맞춘다 — `normalizeName` 이 TS 함수라
/// 표기 흔들림(`Cotton Candy` → `cottoncandy`)을 DB 가 접을 수 없다. 그래서 앱에서
/// 맞춘다. `collectLookupIds` 가 같은 사정으로 같은 모양을 쓴다 (설계 4-3).
export type AliasColor = { raw: string; rawEn?: string | null; color: string | null };

/// 색이 박힌 별칭만 담은 조회표. **기본이 상속이라 대부분 null 이고 이 표는 작다** —
/// 별칭 전량을 싣지 않는다.
export function aliasColorMap(aliases: AliasColor[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of aliases) {
    if (!a.color) continue;
    map.set(normalizeName(a.raw), a.color);
    // 병합된 영문 표기도 같은 행이다. 판매자 노트는 어느 표기로든 올 수 있다
    if (a.rawEn) map.set(normalizeName(a.rawEn), a.color);
  }
  return map;
}

/// 노트의 색. `raw` 로 별칭 색을 먼저 찾고, 없으면 앉은 축에서 물려받는다.
export function noteColor(
  raw: string,
  node: { color: string | null; parent: { color: string | null } | null } | null,
  aliasColors: Map<string, string>,
): string | null {
  return aliasColors.get(normalizeName(raw)) ?? node?.color ?? node?.parent?.color ?? null;
}
