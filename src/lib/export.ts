import type { PrismaClient } from "@prisma/client";

import pkg from "../../package.json";

/// 내보내기 (요구 FR-8). **수용 기준이 「파괴적 마이그레이션 직전에 이것만으로 전체
/// 복원이 가능하다」다** — 그래서 내 기록만이 아니라 DB 전량을 담는다.
/// 향 계층 · 별칭 · lookup · 원두 · 노트가 없으면 판정값만 남고 무엇에 대한 판정이었는지가
/// 사라진다.

/// 이 파일이 내놓는 봉투의 형식 번호. **손으로 올린다.**
///
/// 올리는 때: 이미 뽑아둔 파일을 **지금 코드로는 못 읽게 되는** 변경.
/// 컬럼 추가나 테이블 추가는 옛 파일이 그대로 읽히므로 올리지 않는다 —
/// 컬럼 제거 · 이름 변경 · 의미 변경이 올릴 자리다.
export const SCHEMA_VERSION = 1;

/// 일부러 안 담는 모델. **`export.test.ts` 가 이 명단을 근거로 "빠뜨린 것" 과 구별한다** —
/// 여기 없는 모델이 빠져 있으면 실수다.
///
/// `InviteAttempt` — 시도 제한 카운터다. 복원할 의미가 없고(15분 창을 보는 값이다)
/// IP 가 들어 있다. 잃어도 기록이 사라지지 않는다.
export const EXCLUDED_MODELS = ["InviteAttempt"];

/// 담는 모델 명단. **키 순서가 FK 부모부터다** — 복원할 때 이 순서로 넣으면 참조가 안 깨진다.
///
/// 이 배열이 아래 `data` 의 타입이 된다. **명단과 실제로 담는 것이 어긋나면 `tsc` 가 잡고**,
/// 명단과 스키마가 어긋나면 `export.test.ts` 가 잡는다. 둘로 나눠야 둘 다 진짜 검사가 된다 —
/// `Prisma.dmmf` 로 테이블을 돌면 모델이 늘 때 자동으로 따라오지만, 그 순간 검사가
/// 자기 자신을 보게 되어 아무것도 못 막는다 (`admin-actions.ts` 와 같은 구조).
export const EXPORTED_MODELS = [
  "User",
  "InviteCode",
  "FlavorNode",
  "NoteAlias",
  "LookupValue",
  "Vendor",
  "Product",
  "SellerNote",
  "SellerNoteProposal",
  "Experience",
  "NoteHit",
  "ExtraNote",
] as const;

export type ExportEnvelope = {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  data: Record<(typeof EXPORTED_MODELS)[number], unknown[]>;
};

/// DB 전량을 한 덩어리로 읽는다.
///
/// `FlavorNode` 는 자기 자신을 참조하므로 테이블 안에서도 level 순으로 정렬한다.
/// 나머지는 id 순이다 — 두 번 뽑은 파일이 같은 순서여야 diff 로 비교가 된다.
///
/// 스트리밍하지 않는다 — 지금 전량이 몇 백 KB 다. 한 번에 못 담을 만큼 커지면
/// 그때는 이 함수가 아니라 전달 방식(라우트 핸들러)이 바뀌어야 한다.
export async function buildExport(db: PrismaClient): Promise<ExportEnvelope> {
  const by = { orderBy: { id: "asc" } } as const;

  const [
    User,
    InviteCode,
    FlavorNode,
    NoteAlias,
    LookupValue,
    Vendor,
    Product,
    SellerNote,
    SellerNoteProposal,
    Experience,
    NoteHit,
    ExtraNote,
  ] = await Promise.all([
    db.user.findMany(by),
    // 코드를 평문 그대로 담는다. 설계 5-2 가 대가로 「백업 파일」을 이미 명시적으로
    // 받아들였고, 빼면 이 파일만으로 복원이 안 된다
    db.inviteCode.findMany(by),
    db.flavorNode.findMany({ orderBy: [{ level: "asc" }, { id: "asc" }] }),
    db.noteAlias.findMany(by),
    db.lookupValue.findMany(by),
    db.vendor.findMany(by),
    db.product.findMany(by),
    db.sellerNote.findMany(by),
    db.sellerNoteProposal.findMany(by),
    db.experience.findMany(by),
    db.noteHit.findMany(by),
    db.extraNote.findMany(by),
  ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    // package.json 에서 읽는다. 적어두면 어긋난다 — 어긋난 버전은 없느니만 못하다
    appVersion: pkg.version,
    data: {
      User,
      InviteCode,
      FlavorNode,
      NoteAlias,
      LookupValue,
      Vendor,
      Product,
      SellerNote,
      SellerNoteProposal,
      Experience,
      NoteHit,
      ExtraNote,
    },
  };
}

/// 내려받는 파일 이름. 날짜가 붙어야 여러 번 받았을 때 덮어쓰지 않는다
export function exportFileName(now = new Date()): string {
  return `sillage-export-${now.toISOString().slice(0, 10)}.json`;
}
