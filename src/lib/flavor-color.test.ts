import { describe, expect, it } from "vitest";

import { aliasColorMap, noteColor } from "./flavor-color";

// 상속 사슬은 세 단이다. **DB 로는 안 보인다** — 별칭과 판매자 노트 사이에 FK 가 없어
// 이 맞물림이 전부 앱 안에서 일어난다.
const L2 = { color: "#222222", parent: { color: "#111111" } };
const L2_NO_COLOR = { color: null, parent: { color: "#111111" } };

describe("noteColor", () => {
  const map = aliasColorMap([
    { raw: "레몬", color: "#ffee00" },
    { raw: "베르가못", color: null },
  ]);

  it("별칭 색이 축 색을 이긴다", () => {
    expect(noteColor("레몬", L2, map)).toBe("#ffee00");
  });

  it("별칭에 색이 없으면 L2 로 내려간다", () => {
    expect(noteColor("베르가못", L2, map)).toBe("#222222");
  });

  it("L2 에도 없으면 L1 에서 물려받는다", () => {
    expect(noteColor("베르가못", L2_NO_COLOR, map)).toBe("#111111");
  });

  it("축이 안 붙은 노트는 색이 없다 — 회색으로 채우지 않는다", () => {
    expect(noteColor("누룩", null, map)).toBe(null);
  });

  it("별칭이 없는 표현도 축에서 물려받는다", () => {
    expect(noteColor("처음 보는 말", L2, map)).toBe("#222222");
  });

  it("표기가 흔들려도 같은 별칭으로 접힌다", () => {
    // **여기가 FK 대신 문자열로 맞추는 대가다.** normalizeName 이 접는 만큼만 맞는다 —
    // DB 조인으로는 이 접힘을 못 만든다
    const m = aliasColorMap([{ raw: "Cotton Candy", color: "#ff99cc" }]);
    expect(noteColor("cotton  candy", null, m)).toBe("#ff99cc");
    expect(noteColor("COTTONCANDY", null, m)).toBe("#ff99cc");
  });

  it("병합된 영문 표기도 같은 색으로 칠해진다", () => {
    // 병합이 소스 행을 지운다. 영문 칸을 표에 안 담으면 `Bergamot` 판매자 노트만 축 색으로 돌아간다
    const m = aliasColorMap([{ raw: "베르가못", rawEn: "Bergamot", color: "#aabb00" }]);
    expect(noteColor("bergamot", L2, m)).toBe("#aabb00");
    expect(noteColor("베르가못", L2, m)).toBe("#aabb00");
  });

  it("색이 없는 별칭은 표에 안 담긴다 — 표는 덮어쓴 것만이다", () => {
    expect(map.size).toBe(1);
  });
});
