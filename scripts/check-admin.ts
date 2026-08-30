// 어드민 경로 확인 — 미매핑 붙이기가 해시를 재계산하고 판정을 살려두는가.
import {
  AliasScope,
  BrewMethod,
  Category,
  NoteHitValue,
  Phase,
  PrismaClient,
} from "@prisma/client";
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
const TAG = "[어드민검증]";

async function cleanup() {
  await prisma.experience.deleteMany({ where: { product: { name: { startsWith: TAG } } } });
  await prisma.product.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.noteAlias.deleteMany({ where: { raw: { in: ["누룩", "클린컵"] } } });
}

async function main() {
  const vendor = await prisma.vendor.findFirst({ select: { id: true } });
  if (!vendor) throw new Error("Vendor 가 없다");
  await cleanup();

  const notes = [
    { raw: "자스민", nodeId: "flower" },
    { raw: "누룩", nodeId: null },
    { raw: "클린컵", nodeId: null },
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
    select: { id: true, noteSetHash: true, sellerNotes: { select: { id: true, raw: true } } },
  });
  const hashBefore = product.noteSetHash;
  const nurukNote = product.sellerNotes.find((n) => n.raw === "누룩")!;
  const cleanNote = product.sellerNotes.find((n) => n.raw === "클린컵")!;

  // 미매핑에도 판정이 붙어 있다
  const exp = await prisma.experience.create({
    data: { userId: USER, productId: product.id, method: BrewMethod.HAND_DRIP, phase: Phase.OVERALL },
    select: { id: true },
  });
  await prisma.noteHit.create({
    data: { experienceId: exp.id, sellerNoteId: nurukNote.id, value: NoteHitValue.STRONG },
  });

  const queued = await prisma.sellerNote.count({ where: { nodeId: null, productId: product.id } });
  ok(queued === 2, `미매핑이 큐에 잡힌다 (${queued}건)`);

  // ── 붙이기
  await prisma.$transaction(async (tx) => {
    await tx.noteAlias.create({
      data: {
        raw: "누룩",
        normalizedRaw: normalizeName("누룩"),
        nodeId: "fermented",
        scope: AliasScope.PUBLIC,
      },
    });
    await tx.sellerNote.updateMany({ where: { raw: "누룩", nodeId: null }, data: { nodeId: "fermented" } });
    const fresh = await tx.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { sellerNotes: { select: { raw: true, nodeId: true } } },
    });
    await tx.product.update({
      where: { id: product.id },
      data: { noteSetHash: computeNoteSetHash(fresh.sellerNotes) },
    });
  });

  const after = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    select: { noteSetHash: true, sellerNotes: { select: { raw: true, nodeId: true } } },
  });
  ok(after.noteSetHash !== hashBefore, "붙이면 noteSetHash 가 재계산된다");
  ok(
    after.noteSetHash === computeNoteSetHash(after.sellerNotes),
    "재계산된 해시가 저장 값과 일치한다",
  );

  const hit = await prisma.noteHit.findFirst({
    where: { experienceId: exp.id, sellerNoteId: nurukNote.id },
    select: { value: true },
  });
  // 축이 바뀐 것이지 판정이 바뀐 게 아니다 (설계 7-4)
  ok(hit?.value === NoteHitValue.STRONG, "붙여도 기존 판정은 그대로다");

  // ── public 별칭 중복 차단 (부분 유니크 인덱스)
  let dup = false;
  try {
    await prisma.noteAlias.create({
      data: {
        raw: "누룩",
        normalizedRaw: normalizeName("누룩"),
        nodeId: "sour",
        scope: AliasScope.PUBLIC,
      },
    });
  } catch {
    dup = true;
  }
  ok(dup, "같은 표현의 public 별칭이 두 개 생기지 않는다");

  // ── 지우기
  const hashBeforeDelete = after.noteSetHash;
  await prisma.sellerNote.delete({ where: { id: cleanNote.id } });
  const afterDelete = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    select: { sellerNotes: { select: { raw: true, nodeId: true } } },
  });
  const recomputed = computeNoteSetHash(afterDelete.sellerNotes);
  ok(recomputed !== hashBeforeDelete, "지우면 해시가 달라진다");
  ok(afterDelete.sellerNotes.length === 2, "향미가 아닌 표기가 사라진다");

  // ── lookup 병합: attributes JSONB 안의 id 에는 FK 를 걸 수 없다 (설계 4-3).
  // 무결성은 애플리케이션이 진다 — 참조가 실제로 갈아끼워지는지 확인한다
  const dupName = `${TAG}무산소표기`;
  const target = await prisma.lookupValue.findFirstOrThrow({
    where: { kind: "PROCESS", nameKo: "무산소 발효" },
    select: { id: true, aliases: true },
  });
  const source = await prisma.lookupValue.create({
    data: {
      kind: "PROCESS",
      nameKo: dupName,
      normalizedName: normalizeName(dupName),
      status: "PENDING",
    },
    select: { id: true },
  });
  const withAttrs = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      category: Category.COFFEE,
      name: `${TAG} 블렌드`,
      normalizedName: normalizeName(`${TAG} 블렌드`),
      noteSetHash: computeNoteSetHash([{ raw: "코코아", nodeId: "cocoa" }]),
      attributes: { kind: "blend", processIds: [source.id], countryIds: ["x"] },
      sellerNotes: { create: [{ raw: "코코아", nodeId: "cocoa", position: 0 }] },
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    const [src, tgt] = await Promise.all([
      tx.lookupValue.findUniqueOrThrow({ where: { id: source.id } }),
      tx.lookupValue.findUniqueOrThrow({ where: { id: target.id } }),
    ]);
    await tx.lookupValue.update({
      where: { id: target.id },
      data: { aliases: [...new Set([...tgt.aliases, src.nameKo, ...src.aliases])] },
    });
    const all = await tx.product.findMany({ select: { id: true, attributes: true } });
    for (const p of all) {
      const a = p.attributes as Record<string, unknown>;
      let touched = false;
      for (const key of ["countryIds", "processIds", "varietyIds"]) {
        const list = a[key];
        if (Array.isArray(list) && list.includes(source.id)) {
          a[key] = list.map((v) => (v === source.id ? target.id : v));
          touched = true;
        }
      }
      if (touched) await tx.product.update({ where: { id: p.id }, data: { attributes: a } });
    }
    await tx.lookupValue.delete({ where: { id: source.id } });
  });

  const merged = await prisma.product.findUniqueOrThrow({
    where: { id: withAttrs.id },
    select: { attributes: true },
  });
  const attrs = merged.attributes as { processIds?: string[] };
  ok(attrs.processIds?.[0] === target.id, "병합이 JSONB 안의 lookup id 를 갈아끼운다");

  const absorbed = await prisma.lookupValue.findUniqueOrThrow({
    where: { id: target.id },
    select: { aliases: true },
  });
  ok(absorbed.aliases.includes(dupName), "없어진 이름이 대상의 aliases 로 흡수된다");
  ok(
    (await prisma.lookupValue.count({ where: { id: source.id } })) === 0,
    "병합 후 원본이 사라진다",
  );

  await prisma.lookupValue.update({
    where: { id: target.id },
    data: { aliases: absorbed.aliases.filter((a) => a !== dupName) },
  });

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
