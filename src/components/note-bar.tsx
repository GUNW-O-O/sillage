/// 노트의 향 색을 보이는 세로 띠 (2026-09-16). 기록 시트의 판정 칩과 원두 상세의 노트가 같이 쓴다.
///
/// **판정과 무관하게 늘 그 노트의 색이다** — 색은 「어떤 향인가」, 칸의 배경은
/// 「얼마나 느꼈나」를 맡는다. 한 칸이 둘을 다 맡으면 원색 위에 글자가 올라가 대비가 깨지고
/// 강도의 색이 향마다 달라져 안 읽힌다.
///
/// 칸의 왼쪽 여백(px-4) 안에 절대 위치로 선다 — 칸 폭이 안 변하고, 모서리 곡률을 따라
/// 휘지 않는 곧은 막대다. 부모에 `relative` 가 있어야 한다.
/// 색이 없는 노트(미분류)는 안 그린다. 없는 색을 회색으로 지어내지 않는다
export function NoteBar({ color }: { color: string | null }) {
  if (!color) return null;
  return (
    <span
      aria-hidden
      data-testid="note-bar"
      style={{ backgroundColor: color }}
      className="absolute top-2.5 bottom-2.5 left-1.5 w-1 rounded-full"
    />
  );
}
