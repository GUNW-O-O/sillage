import { describe, expect, it } from "vitest";

import { revealCount } from "./detail-field-reveal";

// 이 로직은 원래 effect 안에서 setState 로 한 칸씩 밀어 올렸다. 계산으로 바꾸면서
// **동작이 같은지**를 여기서 지킨다. 옛 동작의 고정점은
// "하한에서 시작해 직전 칸이 채워져 있는 동안 민다" 였다.
describe("revealCount", () => {
  const F = false;
  const T = true;

  it("빈 폼은 첫 칸만 연다", () => {
    expect(revealCount([F, F, F], 1)).toBe(1);
  });

  it("첫 칸을 채우면 다음 칸이 열린다", () => {
    expect(revealCount([T, F, F], 1)).toBe(2);
  });

  it("연속으로 채워진 만큼 한 번에 민다 — 옛 effect 는 여기서 렌더를 연쇄했다", () => {
    expect(revealCount([T, T, T, F, F], 1)).toBe(4);
  });

  it("빈 칸에서 멈춘다", () => {
    expect(revealCount([T, F, T, T], 1)).toBe(2);
  });

  it("전부 채워도 칸 수를 넘지 않는다", () => {
    expect(revealCount([T, T, T], 1)).toBe(3);
  });

  it("건너뛴 빈 칸을 자동 노출이 다시 삼키지 않는다", () => {
    // 2번 칸을 건너뛰어 하한이 3. 하한 없이 채워진 칸만 세면 1번에서 멈춘다
    expect(revealCount([T, F, F, F], 3)).toBe(3);
  });

  it("건너뛴 뒤에도 이어서 민다", () => {
    // 하한 4에서 시작, 4번 칸이 채워져 있으므로 5번이 열린다
    expect(revealCount([T, T, F, T, F], 4)).toBe(5);
  });

  it("구성이 바뀌어 칸 수가 줄면 하한도 잘린다", () => {
    // single → blend 로 바뀌면 지역 · 농장 · 프로듀서 · 로트가 목록에서 빠진다
    expect(revealCount([T, F], 9)).toBe(2);
  });

  it("하한이 1 밑으로 내려가지 않는다", () => {
    expect(revealCount([F, F], 0)).toBe(1);
  });

  it("해당하는 칸이 없으면 0", () => {
    expect(revealCount([], 1)).toBe(0);
  });
});
