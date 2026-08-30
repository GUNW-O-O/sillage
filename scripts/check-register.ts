// 등록 경로의 위험 지점을 실제 DB 로 확인한다 — noteSetHash 와 unique 충돌.
// 순수 함수는 vitest 가 잡지만, 제약은 DB 에 걸려 있어 DB 로만 확인된다.
import { Category, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

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

  await prisma.product.deleteMany({ where: { name: { startsWith: "[검증]" } } });
  if (failed > 0) {
    console.error(`\n${failed}건 실패`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
