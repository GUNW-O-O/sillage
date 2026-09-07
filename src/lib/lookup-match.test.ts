import { describe, expect, it } from "vitest";

import { findExistingLookup, isSameLookup } from "./lookup-match";

// 실제 시드 행이다 (prisma/seed-data.ts)
const 게이샤 = { nameKo: "게이샤", nameEn: "Geisha", aliases: ["게샤", "Gesha"] };
const 워시드 = { nameKo: "워시드", nameEn: "Washed", aliases: ["수세식", "습식"] };
const 타라투 = { nameKo: "타라투", nameEn: null, aliases: [] };

describe("isSameLookup", () => {
  it("한글 이름으로 찾는다", () => {
    expect(isSameLookup(게이샤, "게이샤")).toBe(true);
  });

  // **이게 이 파일의 이유다.** normalizedName 은 nameKo 에서만 나오므로
  // unique 제약이 이 경우를 원리적으로 못 막는다
  it("영문 이름으로도 같은 것이다", () => {
    expect(isSameLookup(게이샤, "Geisha")).toBe(true);
    expect(isSameLookup(워시드, "Washed")).toBe(true);
  });

  it("대소문자와 공백을 흡수한다", () => {
    expect(isSameLookup(게이샤, "geisha")).toBe(true);
    expect(isSameLookup(게이샤, "  GEISHA  ")).toBe(true);
  });

  it("별칭으로도 찾는다", () => {
    expect(isSameLookup(게이샤, "게샤")).toBe(true);
    expect(isSameLookup(게이샤, "gesha")).toBe(true);
  });

  it("영문 이름이 없는 행도 던지지 않는다", () => {
    expect(isSameLookup(타라투, "타라투")).toBe(true);
    expect(isSameLookup(타라투, "Taratu")).toBe(false);
  });

  // 붙이면 안 되는 쪽. 여기가 느슨해지면 서로 다른 품종이 하나로 접힌다
  it("다른 이름은 안 붙인다", () => {
    expect(isSameLookup(게이샤, "티피카")).toBe(false);
    expect(isSameLookup(워시드, "내추럴")).toBe(false);
  });

  it("부분 일치로는 안 붙인다", () => {
    // "무산소 워시드" 는 별개의 가공이다. contains 로 봤다면 여기서 붙어버린다
    expect(isSameLookup(워시드, "무산소 워시드")).toBe(false);
    expect(isSameLookup(워시드, "Anaerobic Washed")).toBe(false);
  });

  it("빈 이름은 아무것과도 안 붙는다", () => {
    expect(isSameLookup(게이샤, "   ")).toBe(false);
    // 기호만 있으면 정규화 결과가 빈 문자열이다
    expect(isSameLookup(게이샤, "···")).toBe(false);
  });
});

describe("findExistingLookup", () => {
  const rows = [게이샤, 워시드, 타라투];

  it("표기가 어느 것이든 같은 행을 집는다", () => {
    expect(findExistingLookup(rows, "Geisha")).toBe(게이샤);
    expect(findExistingLookup(rows, "습식")).toBe(워시드);
  });

  it("없으면 undefined 다 — 그때만 새로 만든다", () => {
    expect(findExistingLookup(rows, "파카마라")).toBeUndefined();
  });
});
