import { normalizeName } from "./normalize";

/// lookup 하나가 가진 **모든 표기**. 같은 값을 가리키는 이름이 셋으로 갈려 있다.
export type LookupNames = {
  nameKo: string;
  nameEn: string | null;
  aliases: string[];
};

/// 이 행이 그 이름으로 불리는가.
///
/// **`@@unique([kind, normalizedName])` 만으로는 못 막는 자리다** — `normalizedName` 은
/// `nameKo` 하나에서만 나오므로 "게이샤" 와 "Geisha" 가 서로 다른 값이 되어
/// 같은 품종이 두 행으로 앉는다. 실제로 `PROCESS` 에 `워시드`(nameEn: Washed)가 있는데
/// `Washed` 가 따로 들어와 있었다.
///
/// 그래서 세 표기를 전부 접어서 본다. 접는 함수는 동일성 판정에 이미 쓰는 것과 같은 것이라
/// "옐로우 부르봉" · "Yellow  Bourbon" 처럼 공백과 대소문자도 같이 흡수된다.
export function isSameLookup(row: LookupNames, name: string): boolean {
  const target = normalizeName(name);
  if (!target) return false;
  return [row.nameKo, row.nameEn, ...row.aliases].some(
    (n) => n != null && normalizeName(n) === target,
  );
}

/// 같은 kind 안에서 그 이름으로 이미 있는 행을 찾는다. 없으면 undefined.
///
/// **행을 전부 받아 JS 에서 접는다.** `normalizeName` 은 NFKC + 기호 제거라 SQL 로 옮길 수
/// 없고, 표기용 컬럼(`nameEn` · `aliases`)에는 정규화 값이 저장돼 있지 않다.
/// 대신 훑는 양이 작다 — 품종 40 · 가공 20 개고, 인라인 추가는 드문 조작이다.
/// 이 집합이 수천으로 자라면 정규화 값을 담는 검색용 컬럼이 필요해진다.
export function findExistingLookup<T extends LookupNames>(rows: T[], name: string): T | undefined {
  return rows.find((row) => isSameLookup(row, name));
}
