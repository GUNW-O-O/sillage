import { describe, expect, it } from "vitest";

import { readableOn } from "./readable-on";

// 색을 배경으로 깔면 글자가 읽히는지가 색마다 달라진다. 눈으로는 「좀 흐린데」 까지만
// 보이고 어디서부터 안 읽히는지는 안 보인다 — 순수 함수라 여기서 지킨다.
describe("readableOn", () => {
  it("옅은 색 위에는 잉크를 올린다", () => {
    // 화이트 플로럴 — 베이지
    expect(readableOn("#d3c3a4")).toBe("#141413");
  });

  it("짙은 색 위에는 캔버스를 올린다", () => {
    // 로스팅 — 짙은 갈색
    expect(readableOn("#57473b")).toBe("#faf9f5");
  });

  it("극단값에서 갈린다", () => {
    expect(readableOn("#ffffff")).toBe("#141413");
    expect(readableOn("#000000")).toBe("#faf9f5");
  });

  it("언제나 대비가 큰 쪽을 고른다", () => {
    // 이 함수가 약속하는 것은 이것 하나다. **AA 를 약속하지 않는다** —
    // 색이 이제 어드민 입력이라 중간 명도가 들어오면 잉크도 캔버스도 4.5:1 을 못 넘는다.
    // 지금 팔레트에서도 향신료 · 풀 · 레드 플로럴 · 차 넷이 4.3~4.4 에 걸린다.
    // 그것은 팔레트에서 고칠 일이고(어드민에서 색을 바꿀 수 있다), 함수가 할 일은
    // 주어진 배경에서 **가능한 최선**을 고르는 것이다
    const palette = [
      "#b1503f", "#c8934e", "#57473b", "#b4682f", "#7d4a63", "#7a5741",
      "#8e8b82", "#a86b8a", "#6d7c4c", "#d3c3a4", "#b2596b", "#97764e",
      "#ffffff", "#000000", "#808080", "#c2a42a", "#d98b33",
    ];
    for (const bg of palette) {
      const picked = readableOn(bg);
      const other = picked === "#141413" ? "#faf9f5" : "#141413";
      expect(ratio(bg, picked), bg).toBeGreaterThanOrEqual(ratio(bg, other));
    }
  });

  it("중간 명도에서도 3:1 은 넘긴다 — UI 요소 최소선", () => {
    // 여기까지도 못 가는 색이 들어오면 칩 글자가 아예 안 읽힌다.
    // 잉크와 캔버스가 양 끝이라 어떤 색이든 한쪽과는 3:1 이 난다
    for (const bg of ["#808080", "#b4682f", "#6d7c4c", "#7f7f7f"]) {
      expect(ratio(bg, readableOn(bg)), bg).toBeGreaterThanOrEqual(3);
    }
  });
});

/// 검증용 대비비. 구현과 같은 식을 쓰면 둘 다 틀려도 통과하므로 여기서 따로 쓴다
function ratio(a: string, b: string): number {
  const lum = (hex: string) => {
    const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
