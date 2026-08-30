import { describe, expect, it } from "vitest";

import { computeNoteSetHash as h } from "./note-set-hash";

// Product 동일성 키의 절반이다 (설계 4-3). 여기가 틀리면 전부 틀린다.
describe("computeNoteSetHash", () => {
  it("집합이라 순서가 결과를 안 바꾼다", () => {
    expect(
      h([
        { raw: "자스민", nodeId: "flower" },
        { raw: "청사과", nodeId: "other_fruit" },
      ]),
    ).toBe(
      h([
        { raw: "청사과", nodeId: "other_fruit" },
        { raw: "자스민", nodeId: "flower" },
      ]),
    );
  });

  it("표현이 달라도 같은 노드면 같은 해시", () => {
    expect(h([{ raw: "패션후르츠", nodeId: "tropical_fruit" }])).toBe(
      h([{ raw: "패션프룻", nodeId: "tropical_fruit" }]),
    );
  });

  it("같은 노드가 여럿이면 하나로 접힌다", () => {
    expect(
      h([
        { raw: "블루베리", nodeId: "berry" },
        { raw: "라즈베리", nodeId: "berry" },
      ]),
    ).toBe(h([{ raw: "블루베리", nodeId: "berry" }]));
  });

  // unmapped 토큰을 빼면 미매핑이 많은 서로 다른 Product 이 같은 키로 충돌한다
  it("미매핑끼리는 raw 로 갈린다", () => {
    expect(h([{ raw: "누룩", nodeId: null }])).not.toBe(h([{ raw: "클린컵", nodeId: null }]));
  });

  it("미매핑 raw 도 정규화 후 비교된다", () => {
    expect(h([{ raw: "누 룩", nodeId: null }])).toBe(h([{ raw: "누룩", nodeId: null }]));
  });

  it("미매핑이 있고 없고가 키를 가른다", () => {
    expect(
      h([
        { raw: "자스민", nodeId: "flower" },
        { raw: "누룩", nodeId: null },
      ]),
    ).not.toBe(h([{ raw: "자스민", nodeId: "flower" }]));
  });

  // 어드민이 미매핑을 붙이면 재계산되고, 그때 다른 Product 과 키가 같아질 수 있다.
  // unique 제약이 걸린 상태라 어드민 큐가 이 경로를 반드시 처리해야 한다 (설계 7-4).
  it("서로 다른 raw 가 같은 노드에 붙으면 키가 같아진다", () => {
    expect(h([{ raw: "누룩", nodeId: "fermented" }])).toBe(
      h([{ raw: "막걸리", nodeId: "fermented" }]),
    );
  });

  it("노트가 없으면 빈 집합의 해시다", () => {
    expect(h([])).toBe(h([]));
    expect(h([])).not.toBe(h([{ raw: "자스민", nodeId: "flower" }]));
  });
});
