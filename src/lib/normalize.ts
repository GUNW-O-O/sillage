/// 표기 흔들림을 흡수해 동일성을 판정하기 위한 정규화 (설계 4-1 · 8장).
/// 함수 인덱스를 쓸 수 없어 이 값을 별도 컬럼에 저장하고 unique 를 건다.
///
/// "옐로우 부르봉" · "옐로우부르봉" · "Yellow  Bourbon" 이 같은 값으로 접히게 한다.
export function normalizeName(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}
