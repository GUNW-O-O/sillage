// 등록 경로의 위험 지점을 실제 DB 로 확인한다 — noteSetHash 와 unique 충돌.
// 순수 함수는 vitest 가 잡지만, 제약은 DB 에 걸려 있어 DB 로만 확인된다.
import { Category, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { createLookup } from "../src/app/actions";
import { computeNoteSetHash } from "../src/lib/note-set-hash";
import { normalizeName } from "../src/lib/normalize";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

let failed = 0;
const ok = (cond: boolean, label: string) => {
  if (!cond) failed += 1;
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
};

async function register(vendorId: string, name: string, notes: { raw: string; nodeId: string | null }[]) {
  const normalizedName = normalizeName(name);
  const noteSetHash = computeNoteSetHash(notes);
  const existing = await prisma.product.findUnique({
    where: {
      vendorId_category_normalizedName_noteSetHash: {
        vendorId,
        category: Category.COFFEE,
        normalizedName,
        noteSetHash,
      },
    },
    select: { id: true },
  });
  if (existing) return { duplicate: true, id: existing.id };

  const p = await prisma.product.create({
    data: {
      vendorId,
      category: Category.COFFEE,
      name,
      normalizedName,
      noteSetHash,
      sellerNotes: { create: notes.map((n, i) => ({ ...n, position: i })) },
    },
    select: { id: true },
  });
  return { duplicate: false, id: p.id };
}

async function main() {
  const vendor = await prisma.vendor.findFirst({ select: { id: true } });
  if (!vendor) throw new Error("Vendor 가 없다. 시드를 먼저 넣어달라");

  await prisma.product.deleteMany({ where: { name: { startsWith: "[검증]" } } });

  const a = await register(vendor.id, "[검증] 구지", [
    { raw: "자스민", nodeId: "flower" },
    { raw: "청사과", nodeId: "other_fruit" },
  ]);
  ok(!a.duplicate, "새 원두가 등록된다");

  const b = await register(vendor.id, "[검증] 구지", [
    { raw: "청사과", nodeId: "other_fruit" },
    { raw: "자스민", nodeId: "flower" },
  ]);
  ok(b.duplicate && b.id === a.id, "노트 순서만 다르면 같은 원두로 잡힌다");

  const c = await register(vendor.id, "[검증]  구지 ", [
    { raw: "자스민", nodeId: "flower" },
    { raw: "청사과", nodeId: "other_fruit" },
  ]);
  ok(c.duplicate && c.id === a.id, "제품명 공백 차이는 정규화가 흡수한다");

  const d = await register(vendor.id, "[검증] 구지", [
    { raw: "자스민", nodeId: "flower" },
    { raw: "청사과", nodeId: "other_fruit" },
    { raw: "홍차", nodeId: "black_tea" },
  ]);
  ok(!d.duplicate, "노트가 하나 늘면 다른 원두다 (크롭 회전을 받는 자리)");

  const e = await register(vendor.id, "[검증] 누룩", [{ raw: "누룩", nodeId: null }]);
  ok(!e.duplicate, "미매핑 노트만 있어도 등록된다");

  const f = await register(vendor.id, "[검증] 누룩", [{ raw: "누 룩", nodeId: null }]);
  ok(f.duplicate && f.id === e.id, "미매핑 raw 도 정규화 후 같은 키가 된다");

  const g = await register(vendor.id, "[검증] 누룩", [{ raw: "막걸리", nodeId: null }]);
  ok(!g.duplicate, "다른 미매핑 raw 는 다른 키다 (unmapped 토큰이 없으면 여기서 충돌)");

  const stored = await prisma.product.findUnique({
    where: { id: e.id },
    select: { noteSetHash: true, sellerNotes: { select: { raw: true, nodeId: true } } },
  });
  ok(stored?.sellerNotes[0]?.nodeId === null, "매핑 실패해도 raw 는 저장된다");
  ok(
    stored?.noteSetHash === computeNoteSetHash(stored!.sellerNotes),
    "저장된 해시가 언제든 재계산 가능하다",
  );

  // 국가 목록은 커피 산지가 위로 온다. 249개를 가나다순으로 깔면 산지가 안 보인다
  const countries = await prisma.lookupValue.findMany({
    where: { kind: "COUNTRY" },
    select: { nameKo: true },
    orderBy: [{ sortWeight: "desc" }, { status: "asc" }, { nameKo: "asc" }],
    take: 6,
  });
  const top = countries.map((c) => c.nameKo);
  ok(top[0] === "에티오피아", `국가 목록 첫 줄이 산지다 (${top.join(" ")})`);
  ok(!top.includes("가나"), "가나다순 상위가 밀려난다");

  await checkLookupDuplicates();

  await prisma.product.deleteMany({ where: { name: { startsWith: "[검증]" } } });
  if (failed > 0) {
    console.error(`\n${failed}건 실패`);
    process.exitCode = 1;
  }
}

/// 인라인 추가가 **이미 있는 것을 다른 표기로 다시 만들지 않는가.**
///
/// `@@unique([kind, normalizedName])` 은 nameKo 에서 나온 값 하나만 보므로 이 경우를
/// 원리적으로 못 막는다 — 그래서 DB 층에 둔다. 규칙 자체는 `lookup-match.test.ts` 가 보고,
/// 여기서는 **행이 정말 안 늘어나는지**를 본다.
///
/// 실제로 `워시드`(nameEn: Washed) 옆에 `Washed` 가 따로 앉아 있었다.
async function checkLookupDuplicates() {
  const before = await prisma.lookupValue.count({ where: { kind: "PROCESS" } });

  const seeded = await prisma.lookupValue.findFirstOrThrow({
    where: { kind: "PROCESS", nameKo: "워시드" },
    select: { id: true, nameEn: true, aliases: true },
  });

  // 영문 이름 · 대소문자 · 별칭 — 셋 다 기존 행으로 되돌아와야 한다
  for (const typed of [seeded.nameEn!, seeded.nameEn!.toLowerCase(), seeded.aliases[0], "  워시드 "]) {
    const got = await createLookup("PROCESS", typed);
    ok(got.id === seeded.id, `"${typed}" 를 추가하면 기존 워시드가 돌아온다`);
  }

  ok(
    (await prisma.lookupValue.count({ where: { kind: "PROCESS" } })) === before,
    "네 번을 눌러도 PROCESS 행이 안 늘어난다",
  );

  // 반대쪽 — 진짜 새 값은 여전히 들어가야 한다. 여기가 막히면 설계 4-8 이 깨진다
  const fresh = `[검증] 가공${Date.now()}`;
  const created = await createLookup("PROCESS", fresh);
  ok(created.nameKo === fresh && created.status === "PENDING", "새 표기는 그대로 추가된다");
  await prisma.lookupValue.deleteMany({ where: { id: created.id } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
