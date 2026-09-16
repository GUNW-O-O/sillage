import { describe, expect, it } from "vitest";

import { COLOR_PALETTE, isAllowedColor } from "./color-palette";

describe("COLOR_PALETTE", () => {
  const all = COLOR_PALETTE.flatMap((g) => g.swatches);

  it("SCA 휠의 110색을 빠짐없이 담는다 — 안쪽 9 · 중간 28 · 바깥 73", () => {
    expect(COLOR_PALETTE).toHaveLength(9);
    expect(all).toHaveLength(110);
  });

  it("값은 소문자 6자리 hex 다 — 저장 검사가 문자열로 비교한다", () => {
    for (const w of all) expect(w.hex, w.name).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("isAllowedColor", () => {
  it("색표의 색은 대소문자와 무관하게 받는다", () => {
    expect(isAllowedColor("#ED1C24", null)).toBe(true);
    expect(isAllowedColor("#ed1c24", null)).toBe(true);
  });

  it("빈 값은 색 지우기라 늘 받는다", () => {
    expect(isAllowedColor("", "#123456")).toBe(true);
  });

  it("색표에 없는 색은 거절한다", () => {
    expect(isAllowedColor("#123456", null)).toBe(false);
  });

  it("지금 저장된 색은 색표에 없어도 받는다 — 라벨만 고치는 저장이 막히면 안 된다", () => {
    expect(isAllowedColor("#b1503f", "#B1503F")).toBe(true);
    expect(isAllowedColor("#b1503f", "#123456")).toBe(false);
  });
});
