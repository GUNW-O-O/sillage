import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { EXCLUDED_MODELS, EXPORTED_MODELS, exportFileName, SCHEMA_VERSION } from "./export";

// **이 검사가 이 기능의 핵심이다.** 모델을 새로 만들고 명단에 안 넣으면 내보낸 파일에서
// 그 테이블만 조용히 빠지고, **복원할 때가 되어서야 안다.**
//
// DB 검사도 브라우저 검사도 이걸 못 본다 — 빠진 테이블은 어느 층에도 "없는 것" 으로만
// 나타나고, 없는 것은 눈에 안 띈다. 스키마와 명단을 대조하는 것이 유일한 방법이라
// 순수 함수 층에 둔다 (`admin-actions.test.ts` 와 같은 자리).
//
// **명단과 실제로 담는 것이 맞는지는 여기서 안 본다.** 그쪽은 `EXPORTED_MODELS` 가
// `data` 의 타입이라 `tsc` 가 잡는다 — 키가 빠지거나 남으면 컴파일이 안 된다.
//
// `Prisma.dmmf` 는 생성된 클라이언트가 들고 있는 스키마 자신이다. DB 연결이 필요 없다.
const SCHEMA_MODELS = Prisma.dmmf.datamodel.models.map((m) => m.name);

describe("내보내기 명단", () => {
  it("스키마 모델을 실제로 읽어냈다", () => {
    // dmmf 가 조용히 비면 아래 검사들이 0건으로 통과한다
    expect(SCHEMA_MODELS.length).toBeGreaterThan(5);
  });

  it("스키마의 모든 모델이 담기거나, 일부러 뺀 명단에 있다", () => {
    const covered = new Set<string>([...EXPORTED_MODELS, ...EXCLUDED_MODELS]);
    // 실패하면 vitest 가 빠진 이름을 그대로 출력한다 — 다음 사람이 그 자리에서 안다
    expect(SCHEMA_MODELS.filter((name) => !covered.has(name))).toEqual([]);
  });

  it("스키마에 없는 유령 이름이 명단에 없다", () => {
    expect(EXPORTED_MODELS.filter((name) => !SCHEMA_MODELS.includes(name))).toEqual([]);
    // 모델을 지웠는데 제외 명단에 이름이 남으면, 나중에 같은 이름으로 다시 만들었을 때
    // 아무도 모르게 export 에서 빠진다
    expect(EXCLUDED_MODELS.filter((name) => !SCHEMA_MODELS.includes(name))).toEqual([]);
  });

  it("일부러 뺀 모델을 동시에 담지 않는다", () => {
    expect(EXPORTED_MODELS.filter((n) => EXCLUDED_MODELS.includes(n))).toEqual([]);
  });
});

it("schemaVersion 이 정수다 (요구 FR-8)", () => {
  expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
});

it("파일 이름에 날짜가 붙는다", () => {
  expect(exportFileName(new Date("2026-09-07T12:00:00Z"))).toBe("sillage-export-2026-09-07.json");
});
