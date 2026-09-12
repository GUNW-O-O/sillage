/// 원두의 노트 색을 순서대로 이어 프로필 띠를 만든다 (설계 2026-09-08 §6).
/// **색이 없는 노트는 뺀다** — 없는 색을 회색으로 채우면 「회색인 향」처럼 보인다.
/// 하나뿐이면 같은 색 두 번이라 단색 띠가 되고, 하나도 없으면 null 이라 띠를 안 그린다.
///
/// 원두 상세와 기록 시트가 같은 띠를 그린다. 한쪽만 고쳐 둘이 어긋나는 것을 막으려고
/// 인라인으로 두지 않고 여기로 꺼냈다.
export function noteGradient(colors: (string | null)[]): string | null {
  const stops = colors.filter((c): c is string => c !== null);
  if (stops.length === 0) return null;
  return `linear-gradient(90deg, ${(stops.length === 1 ? [stops[0], stops[0]] : stops).join(", ")})`;
}
