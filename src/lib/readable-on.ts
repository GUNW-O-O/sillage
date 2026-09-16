/// 향 색을 배경으로 깔았을 때 그 위에 올릴 글자색을 고른다.
///
/// **보색이 아니라 대비다.** 보색은 채도가 같아 명도 차가 안 나고, 노란 배경의 파란
/// 글씨처럼 읽기가 더 나빠진다. WCAG 상대 휘도로 대비비를 재서 잉크와 캔버스 중
/// 큰 쪽을 고른다 — 옅은 색 위에는 잉크, 짙은 색 위에는 캔버스가 나온다.
const INK = "#141413";
const CANVAS = "#faf9f5";

/// WCAG 2.x 상대 휘도. sRGB 각 채널을 선형화해 가중 합한다
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/// `bg` 위에서 더 잘 읽히는 글자색. 6자리 hex 만 받는다 (updateFlavorNode 가 그것만 저장한다)
export function readableOn(bg: string): string {
  const l = luminance(bg);
  return contrast(l, luminance(INK)) >= contrast(l, luminance(CANVAS)) ? INK : CANVAS;
}
