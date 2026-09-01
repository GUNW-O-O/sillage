// Product 수정을 누구나 열어도 기존 기록이 안 깨지는가.
// 주장: 읽는 쪽이 sellerNotes 기준으로 렌더하고 noteHits 가 없으면 MISS 로 채우므로
// 노트가 늘어도 소급 주입 없이 안전하다. 위험한 것은 삭제뿐이다.
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
const TAG = "[수정검증]";

async function cleanup() {
  await prisma.experience.deleteMany({ where: { product: { name: { startsWith: TAG } } } });
  await prisma.product.deleteMany({ where: { name: { startsWith: TAG } } });
}

/// 기록 화면이 하는 일 그대로 — sellerNotes 를 기준으로 읽고 없으면 MISS
async function renderRecord(productId: string) {
  const p = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: {
      sellerNotes: { select: { id: true, raw: true }, orderBy: { position: "asc" } },
      experiences: {
        where: { userId: USER },
        select: { updatedAt: true, noteHits: { select: { sellerNoteId: true, value: true } } },
        take: 1,
      },
    },
  });
  const exp = p.experiences[0];
  const map = new Map(exp?.noteHits.map((h) => [h.sellerNoteId, h.value]) ?? []);
  return p.sellerNotes.map((n) => ({
    raw: n.raw,
    value: map.get(n.id) ?? NoteHitValue.MISS,
  }));
}

async function main() {
  const vendor = await prisma.vendor.findFirstOrThrow({ select: { id: true } });
  await cleanup();

  const notes = [
    { raw: "자스민", nodeId: "flower" },
    { raw: "청사과", nodeId: "other_fruit" },
  ];
  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      category: Category.COFFEE,
      name: `${TAG} 구지`,
      normalizedName: normalizeName(`${TAG} 구지`),
      noteSetHash: computeNoteSetHash(notes),
      sellerNotes: { create: notes.map((n, i) => ({ ...n, position: i })) },
    },
    select: { id: true, sellerNotes: { select: { id: true, raw: true } } },
  });
  const jasmine = product.sellerNotes.find((n) => n.raw === "자스민")!;

  const exp = await prisma.experience.create({
    data: { userId: USER, productId: product.id, method: BrewMethod.HAND_DRIP, phase: Phase.OVERALL },
    select: { id: true },
  });
  await prisma.noteHit.create({
    data: { experienceId: exp.id, sellerNoteId: jasmine.id, value: NoteHitValue.STRONG },
  });

  ok((await renderRecord(product.id)).length === 2, "기록이 노트 2개로 읽힌다");

  // ── 다른 사람이 노트를 추가한다. 소급 주입은 하지 않는다
  await prisma.sellerNote.create({
    data: { productId: product.id, raw: "홍차", nodeId: "black_tea", position: 2 },
  });
  const fresh = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    select: { sellerNotes: { select: { raw: true, nodeId: true } } },
  });
  await prisma.product.update({
    where: { id: product.id },
    data: { noteSetHash: computeNoteSetHash(fresh.sellerNotes) },
  });

  const rendered = await renderRecord(product.id);
  ok(rendered.length === 3, "추가된 노트가 기존 기록에 나타난다 (소급 주입 없이)");
  ok(
    rendered.find((r) => r.raw === "홍차")?.value === NoteHitValue.MISS,
    "추가된 노트는 못 느낌으로 읽힌다",
  );
  ok(
    rendered.find((r) => r.raw === "자스민")?.value === NoteHitValue.STRONG,
    "기존 판정은 그대로다",
  );

  // ── 표기 수정은 소급이 아니다
  await prisma.sellerNote.update({ where: { id: jasmine.id }, data: { raw: "자스민꽃" } });
  const afterRename = await renderRecord(product.id);
  ok(
    afterRename.find((r) => r.raw === "자스민꽃")?.value === NoteHitValue.STRONG,
    "표기를 고쳐도 판정이 따라간다",
  );

  // ── 판정 붙은 노트는 못 지운다
  const hitCount = await prisma.noteHit.count({ where: { sellerNoteId: jasmine.id } });
  ok(hitCount > 0, "그 노트에 판정이 붙어 있다");

  // ── 제품명 수정은 키를 움직인다
  const before = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    select: { normalizedName: true },
  });
  const newName = `${TAG} 구지 워시드`;
  await prisma.product.update({
    where: { id: product.id },
    data: { name: newName, normalizedName: normalizeName(newName) },
  });
  const after = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    select: { normalizedName: true },
  });
  ok(after.normalizedName !== before.normalizedName, "제품명을 고치면 동일성 키가 움직인다");
  ok(
    (await renderRecord(product.id)).find((r) => r.raw === "자스민꽃")?.value ===
      NoteHitValue.STRONG,
    "제품명을 고쳐도 판정은 그대로다",
  );

  // ── 목록에서 "새 노트"가 세어지는가. 기록을 열어봐야 아는 배지는
  // 열 이유가 없으면 영영 안 보인다 — 목록에서 보여야 알아차린다
  const row = await prisma.experience.findFirstOrThrow({
    where: { userId: USER, productId: product.id },
    select: {
      updatedAt: true,
      product: { select: { sellerNotes: { select: { addedAt: true, raw: true } } } },
    },
  });
  const freshNotes = row.product.sellerNotes.filter((n) => n.addedAt > row.updatedAt);
  ok(freshNotes.length === 1, `기록 이후 추가된 노트가 목록에서 세어진다 (${freshNotes.length}건)`);
  ok(freshNotes[0]?.raw === "홍차", "세어진 것이 실제로 나중에 추가한 노트다");

  // 다시 저장하면 확인한 것이 되어 표시가 사라진다
  await prisma.experience.update({
    where: { userId_productId_method_phase: {
      userId: USER, productId: product.id,
      method: BrewMethod.HAND_DRIP, phase: Phase.OVERALL,
    } },
    data: { updatedAt: new Date() },
  });
  const after2 = await prisma.experience.findFirstOrThrow({
    where: { userId: USER, productId: product.id },
    select: {
      updatedAt: true,
      product: { select: { sellerNotes: { select: { addedAt: true } } } },
    },
  });
  ok(
    after2.product.sellerNotes.filter((n) => n.addedAt > after2.updatedAt).length === 0,
    "다시 저장하면 표시가 사라진다",
  );

  // ── 스펙(attributes) 수정은 동일성 키를 건드리지 않는다.
  // 원두 상세에서 나라 · 가공을 고쳐도 기존 판정이 그대로여야 수정을 열어둘 수 있다.
  // attributes 는 @@unique([vendorId, category, normalizedName, noteSetHash]) 밖이라
  // 이름 수정과 달리 충돌 검사가 필요 없다 — 그 주장을 여기서 지킨다
  const beforeSpec = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    select: { noteSetHash: true, normalizedName: true },
  });
  const hitsBefore = await prisma.noteHit.count({
    where: { sellerNote: { productId: product.id } },
  });

  await prisma.product.update({
    where: { id: product.id },
    data: { attributes: { kind: "single", infused: false, region: "예가체프", farm: "구지" } },
  });

  const afterSpec = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    select: { noteSetHash: true, normalizedName: true, attributes: true },
  });
  ok(afterSpec.noteSetHash === beforeSpec.noteSetHash, "스펙을 고쳐도 noteSetHash 가 안 변한다");
  ok(
    afterSpec.normalizedName === beforeSpec.normalizedName,
    "스펙을 고쳐도 정규화 이름이 안 변한다",
  );
  ok(
    (afterSpec.attributes as { region?: string }).region === "예가체프",
    "고친 스펙이 실제로 저장된다",
  );
  ok(
    (await prisma.noteHit.count({ where: { sellerNote: { productId: product.id } } })) ===
      hitsBefore,
    "스펙을 고쳐도 판정 수가 안 변한다",
  );
  ok(
    (await renderRecord(product.id)).find((r) => r.raw === "자스민꽃")?.value ===
      NoteHitValue.STRONG,
    "스펙을 고쳐도 판정 값이 그대로다",
  );

  await cleanup();
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
