import { describe, expect, it } from "vitest";

import { normalizeName } from "./normalize";

// unique 제약이 이 값에 걸린다 (설계 4-1 · 8장).
describe("normalizeName", () => {
  it("공백과 대소문자를 흡수한다", () => {
    expect(normalizeName("Yellow  Bourbon")).toBe(normalizeName("yellowbourbon"));
    expect(normalizeName("옐로우 부르봉")).toBe(normalizeName("옐로우부르봉"));
  });

  it("구두점과 기호를 뺀다", () => {
    expect(normalizeName("Cenicafé-1")).toBe(normalizeName("Cenicafé 1"));
    expect(normalizeName("에티오피아 · 구지")).toBe(normalizeName("에티오피아구지"));
  });

  it("숫자는 남긴다 — SL28 과 SL34 가 갈려야 한다", () => {
    expect(normalizeName("SL28")).not.toBe(normalizeName("SL34"));
    expect(normalizeName("SL28")).toBe("sl28");
  });

  it("전각과 반각을 같은 값으로 접는다 (NFKC)", () => {
    expect(normalizeName("ＳＬ２８")).toBe(normalizeName("SL28"));
  });

  it("서로 다른 이름은 갈린다", () => {
    expect(normalizeName("게이샤")).not.toBe(normalizeName("게샤"));
  });
});
