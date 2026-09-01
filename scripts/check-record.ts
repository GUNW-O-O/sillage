// 기록 경로 확인 — 1:1 제약과 4상태 저장. DB 에 걸린 것이라 DB 로만 확인된다.
import { BrewMethod, Category, NoteHitValue, Phase, PrismaClient } from "@prisma/client";
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

const USER = "seed-admin";

async function upsertRecord(productId: string, hits: { sellerNoteId: string; value: NoteHitValue }[]) {
  return prisma.$transaction(async (tx) => {
    const exp = await tx.experience.upsert({
      where: {
        userId_productId_method_phase: {
          userId: USER,
          productId,
          method: BrewMethod.HAND_DRIP,
          phase: Phase.OVERALL,
        },
      },
      update: {},
      create: { userId: USER, productId, method: BrewMethod.HAND_DRIP, phase: Phase.OVERALL },
      select: { id: true },
    });
    for (const h of hits) {
      await tx.noteHit.upsert({
        where: { experienceId_sellerNoteId: { experienceId: exp.id, sellerNoteId: h.sellerNoteId } },
        update: { value: h.value },
        create: { experienceId: exp.id, sellerNoteId: h.sellerNoteId, value: h.value },
      });
    }
    return exp.id;
  });
}

async function main() {
  const vendor = await prisma.vendor.findFirst({ select: { id: true } });
  if (!vendor) throw new Error("Vendor 가 없다");

  // 기록이 붙어 있으면 Product 삭제가 막히므로 기록부터 지운다
  const cleanup = async () => {
    await prisma.experience.deleteMany({
      where: { product: { name: { startsWith: "[기록검증]" } } },
    });
    await prisma.product.deleteMany({ where: { name: { startsWith: "[기록검증]" } } });
  };
  await cleanup();

  const notes = [
    { raw: "자스민", nodeId: "flower" },
    { raw: "청사과", nodeId: "other_fruit" },
    { raw: "누룩", nodeId: null },
  ];
  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      category: Category.COFFEE,
      name: "[기록검증] 구지",
      normalizedName: normalizeName("[기록검증] 구지"),
      noteSetHash: computeNoteSetHash(notes),
      sellerNotes: { create: notes.map((n, i) => ({ ...n, position: i })) },
    },
    select: { id: true, sellerNotes: { select: { id: true, raw: true }, orderBy: { position: "asc" } } },
  });

  const [n0, n1, n2] = product.sellerNotes;

  // 안 건드린 노트는 MISS 로 들어간다 (설계 4-5)
  const expId = await upsertRecord(product.id, [
    { sellerNoteId: n0.id, value: NoteHitValue.STRONG },
    { sellerNoteId: n1.id, value: NoteHitValue.MISS },
    { sellerNoteId: n2.id, value: NoteHitValue.UNSURE },
  ]);
  ok(!!expId, "기록이 저장된다");

  const again = await upsertRecord(product.id, [
    { sellerNoteId: n0.id, value: NoteHitValue.WEAK },
  ]);
  ok(again === expId, "같은 원두를 다시 저장해도 기록은 하나다 (1:1)");

  const hits = await prisma.noteHit.findMany({
    where: { experienceId: expId },
    select: { sellerNoteId: true, value: true },
  });
  ok(hits.length === 3, `노트 항목 단위 행으로 저장된다 (${hits.length}행)`);
  ok(
    hits.find((h) => h.sellerNoteId === n0.id)?.value === NoteHitValue.WEAK,
    "다시 저장하면 판정값이 갱신된다",
  );
  ok(
    hits.find((h) => h.sellerNoteId === n1.id)?.value === NoteHitValue.MISS,
    "안 건드린 노트는 MISS 로 남는다",
  );

  const count = await prisma.experience.count({ where: { userId: USER, productId: product.id } });
  ok(count === 1, "동일성 키가 중복 기록을 막는다");

  // 미매핑 노트에도 판정이 붙는다 — 어드민이 나중에 노드를 붙여도 판정은 유지된다
  ok(
    hits.find((h) => h.sellerNoteId === n2.id)?.value === NoteHitValue.UNSURE,
    "미매핑 노트에도 판정이 붙는다",
  );

  // 기록이 붙은 Product 은 지워지지 않는다. 판정이 조용히 사라지면 안 된다
  let blocked = false;
  try {
    await prisma.product.delete({ where: { id: product.id } });
  } catch {
    blocked = true;
  }
  ok(blocked, "기록이 붙은 Product 은 삭제가 막힌다 (FK restrict)");

  // 기록을 먼저 지우면 noteHits 는 cascade 로 함께 사라진다
  await prisma.experience.delete({ where: { id: expId } });
  ok(
    (await prisma.noteHit.count({ where: { experienceId: expId } })) === 0,
    "기록을 지우면 noteHits 가 cascade 로 정리된다",
  );

  // ── 내가 느낀 향 (ExtraNote). 판매자가 안 적은 축을 담는다.
  // 판정이 안 붙으므로 판매자 노트처럼 부분 보존할 것이 없다 — 저장 때마다 통째 교체다.
  // 위에서 기록을 지웠으므로 다시 만든다
  const exp2 = await upsertRecord(product.id, [
    { sellerNoteId: n0.id, value: NoteHitValue.STRONG },
    { sellerNoteId: n1.id, value: NoteHitValue.MISS },
    { sellerNoteId: n2.id, value: NoteHitValue.UNSURE },
  ]);
  const hashBefore = (
    await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { noteSetHash: true },
    })
  ).noteSetHash;

  await prisma.extraNote.createMany({
    data: [
      { experienceId: exp2, raw: "홍차", nodeId: "black_tea" },
      // 자동완성에 없는 표현. raw 는 버리지 않는다 (요구 4장)
      { experienceId: exp2, raw: "젖은 종이", nodeId: null },
    ],
  });
  const extras = await prisma.extraNote.findMany({
    where: { experienceId: exp2 },
    select: { raw: true, nodeId: true },
  });
  ok(extras.length === 2, `내가 느낀 향이 기록에 붙는다 (${extras.length}건)`);
  ok(
    extras.some((e) => e.raw === "젖은 종이" && e.nodeId === null),
    "축이 안 붙어도 raw 는 저장된다 — 미매핑 큐에서 붙인다",
  );

  ok(
    (await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { noteSetHash: true },
    })).noteSetHash === hashBefore,
    "내가 느낀 향은 Product 동일성 키를 안 건드린다",
  );

  // 저장 화면이 하는 일 그대로 — 지우고 다시 넣는다. 중복이 쌓이면 안 된다
  await prisma.extraNote.deleteMany({ where: { experienceId: exp2 } });
  await prisma.extraNote.createMany({ data: [{ experienceId: exp2, raw: "홍차", nodeId: "black_tea" }] });
  ok(
    (await prisma.extraNote.count({ where: { experienceId: exp2 } })) === 1,
    "다시 저장하면 목록이 통째로 교체된다 (중복이 안 쌓인다)",
  );

  ok(
    (await prisma.noteHit.count({ where: { experienceId: exp2 } })) === 3,
    "내가 느낀 향을 고쳐도 판매자 노트 판정은 그대로다",
  );

  await prisma.experience.delete({ where: { id: exp2 } });
  ok(
    (await prisma.extraNote.count({ where: { experienceId: exp2 } })) === 0,
    "기록을 지우면 내가 느낀 향도 cascade 로 사라진다",
  );

  await prisma.product.deleteMany({ where: { name: { startsWith: "[기록검증]" } } });
  ok(
    (await prisma.sellerNote.count({ where: { productId: product.id } })) === 0,
    "Product 를 지우면 sellerNotes 가 cascade 로 정리된다",
  );

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
