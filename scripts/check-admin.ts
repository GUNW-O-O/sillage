// 어드민 경로 확인 — 미매핑 붙이기가 해시를 재계산하고 판정을 살려두는가.
import {
  AliasScope,
  Prisma,
  BrewMethod,
  Category,
  NoteHitValue,
  Phase,
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import {
  addSellerNote,
  approveNoteProposal,
  listNoteProposals,
  listProductProposals,
  proposeSellerNote,
  rejectNoteProposal,
  withdrawNoteProposal,
  attachNote,
  deleteExtraNote,
  deleteSellerNote,
  listUnmappedNotes,
} from "../src/app/actions";
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
  await prisma.noteAlias.deleteMany({ where: { raw: { in: ["누룩", "클린컵", "젖은판지"] } } });
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

  // ── 재매핑: 잘못 앉은 표현을 다른 축으로 옮긴다 (설계 7-4).
  // 축이 바뀐 것이지 판정이 바뀐 게 아니므로 판정값은 살아 있어야 한다
  const aliasRow = await prisma.noteAlias.findFirstOrThrow({
    where: { raw: "누룩" },
    select: { id: true },
  });
  const hashBeforeRemap = (
    await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { noteSetHash: true },
    })
  ).noteSetHash;

  await prisma.$transaction(async (tx) => {
    await tx.noteAlias.update({ where: { id: aliasRow.id }, data: { nodeId: "sour" } });
    await tx.sellerNote.updateMany({ where: { raw: "누룩" }, data: { nodeId: "sour" } });
    const fresh = await tx.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { sellerNotes: { select: { raw: true, nodeId: true } } },
    });
    await tx.product.update({
      where: { id: product.id },
      data: { noteSetHash: computeNoteSetHash(fresh.sellerNotes) },
    });
  });

  const remapped = await prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    select: { noteSetHash: true, sellerNotes: { select: { raw: true, nodeId: true } } },
  });
  ok(remapped.noteSetHash !== hashBeforeRemap, "재매핑하면 noteSetHash 가 다시 계산된다");
  ok(
    remapped.sellerNotes.find((n) => n.raw === "누룩")?.nodeId === "sour",
    "그 표현을 쓰는 판매자 노트가 함께 옮겨진다",
  );
  const hitAfterRemap = await prisma.noteHit.findFirst({
    where: { experienceId: exp.id, sellerNoteId: nurukNote.id },
    select: { value: true },
  });
  ok(hitAfterRemap?.value === NoteHitValue.STRONG, "재매핑해도 판정값은 그대로다");

  // ── 매핑 지우기: 미매핑 큐로 되돌린다. 데이터를 버리는 것이 아니라 다시 판단하게 하는 것
  await prisma.$transaction(async (tx) => {
    await tx.sellerNote.updateMany({ where: { raw: "누룩" }, data: { nodeId: null } });
    await tx.noteAlias.delete({ where: { id: aliasRow.id } });
  });
  const backToQueue = await prisma.sellerNote.count({
    where: { raw: "누룩", nodeId: null, productId: product.id },
  });
  ok(backToQueue === 1, "매핑을 지우면 미매핑 큐로 돌아간다");
  ok(
    (await prisma.noteHit.count({ where: { sellerNoteId: nurukNote.id } })) === 1,
    "미매핑으로 돌려도 판정은 남는다",
  );

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
      if (touched)
        await tx.product.update({
          where: { id: p.id },
          data: { attributes: a as Prisma.InputJsonValue },
        });
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

  // ── 미매핑 큐가 `내가 느낀 향` 도 훑는가.
  // 안 훑으면 축이 없는 채로 쌓이기만 해서 집계에 영영 안 들어간다 —
  // 판매자 노트의 미매핑과 같은 문제다 (설계 3-2)
  const qProduct = await prisma.product.create({
    data: {
      vendorId: (await prisma.vendor.findFirstOrThrow({ select: { id: true } })).id,
      category: Category.COFFEE,
      name: `${TAG} 큐`,
      normalizedName: normalizeName(`${TAG} 큐`),
      noteSetHash: computeNoteSetHash([{ raw: "젖은판지", nodeId: null }]),
      sellerNotes: { create: [{ raw: "젖은판지", nodeId: null, position: 0 }] },
    },
    select: { id: true, noteSetHash: true },
  });
  const qExp = await prisma.experience.create({
    data: {
      userId: USER,
      productId: qProduct.id,
      method: BrewMethod.HAND_DRIP,
      phase: Phase.OVERALL,
      // 판매자 노트와 **같은 표현**이다. 사전이 하나여야 하므로 한 줄로 묶여야 한다
      extraNotes: { create: [{ raw: "젖은판지", nodeId: null }] },
    },
    select: { id: true },
  });

  const queue = await listUnmappedNotes();
  const mine = queue.filter((n) => n.raw === "젖은판지");
  ok(mine.length === 2, `미매핑 큐가 판매자 노트와 내 기록을 함께 싣는다 (${mine.length}건)`);
  ok(
    mine.some((n) => n.source === "SELLER") && mine.some((n) => n.source === "EXTRA"),
    "출처가 구분된다",
  );
  ok(
    mine.every((n) => n.sameRawCount === 2),
    "같은 표현 개수는 출처를 가리지 않고 센다",
  );

  const attached = await attachNote("젖은판지", "other_fruit");
  ok(attached.ok, "붙이기가 성공한다");
  ok(
    (await prisma.extraNote.findFirstOrThrow({ where: { experienceId: qExp.id } })).nodeId ===
      "other_fruit",
    "판매자 노트를 붙이면 같은 표현의 내 기록도 함께 붙는다",
  );
  ok(
    (await listUnmappedNotes()).every((n) => n.raw !== "젖은판지"),
    "붙인 표현은 큐에서 사라진다",
  );

  // ExtraNote 는 동일성 키 밖이다. 붙여도 해시가 움직이면 안 된다 —
  // 움직이면 다른 원두와 키가 충돌할 수 있고 그건 판매자 노트에만 있어야 할 위험이다
  const qAfter = await prisma.product.findUniqueOrThrow({
    where: { id: qProduct.id },
    select: { noteSetHash: true },
  });
  ok(
    qAfter.noteSetHash !== qProduct.noteSetHash,
    "판매자 노트를 붙이면 noteSetHash 가 재계산된다",
  );
  const beforeDelete = qAfter.noteSetHash;
  await deleteExtraNote(
    (await prisma.extraNote.findFirstOrThrow({ where: { experienceId: qExp.id } })).id,
  );
  ok(
    (await prisma.product.findUniqueOrThrow({
      where: { id: qProduct.id },
      select: { noteSetHash: true },
    })).noteSetHash === beforeDelete,
    "내 기록의 향을 지워도 noteSetHash 는 안 움직인다",
  );

  // ── 노트 추가 · 삭제가 어드민 전용인가.
  // 화면에서 버튼을 뺀 것만으로는 안 막힌다 — 서버 액션은 경로만 알면 요청이 들어오는
  // 공개 엔드포인트다. 시드 계정이 ADMIN 이라 통과하는지가 아니라, **USER 면 막히는지**를
  // 봐야 실제로 걸려 있는 것이다. 역할을 잠깐 내렸다 되돌린다
  try {
    await prisma.user.update({ where: { id: USER }, data: { role: "USER" } });

    const added = await addSellerNote(qProduct.id, "권한검증", null);
    ok(!added.ok, `USER 는 노트를 추가할 수 없다 (${added.ok ? "통과해버림" : added.message})`);

    const someNote = await prisma.sellerNote.findFirstOrThrow({
      where: { productId: qProduct.id },
      select: { id: true },
    });
    const removed = await deleteSellerNote(someNote.id);
    ok(!removed.ok, "USER 는 노트를 지울 수 없다");

    ok(
      (await prisma.sellerNote.count({ where: { productId: qProduct.id, raw: "권한검증" } })) === 0,
      "막힌 요청이 아무것도 안 남긴다",
    );
  } finally {
    // 되돌리지 않으면 다른 검사와 앱 전체가 어드민을 잃는다
    await prisma.user.update({ where: { id: USER }, data: { role: "ADMIN" } });
  }

  ok(
    (await prisma.user.findUniqueOrThrow({ where: { id: USER }, select: { role: true } })).role ===
      "ADMIN",
    "검증 뒤 역할이 되돌아왔다",
  );
  const asAdmin = await addSellerNote(qProduct.id, "권한검증", null);
  ok(asAdmin.ok, `ADMIN 은 노트를 추가한다 (${asAdmin.ok ? "" : asAdmin.message})`);

  // ── 노트 추가 제안. 사용자는 제안만 하고 노트는 어드민이 올린다.
  // 노트는 Product 동일성 키의 절반이라 사람마다 다르게 보일 수 없다 —
  // pending 로스터리처럼 "낸 사람에게는 즉시 보인다" 를 못 한다
  const beforeNotes = await prisma.sellerNote.count({ where: { productId: qProduct.id } });

  ok((await proposeSellerNote(qProduct.id, "제안검증", null)).ok, "노트를 제안한다");
  ok(
    (await prisma.sellerNote.count({ where: { productId: qProduct.id } })) === beforeNotes,
    "제안은 노트가 되지 않는다 — 승격 전에는 어느 화면에도 안 나온다",
  );

  // 같은 사람이 두 번 눌러도 동의는 1이다. @@unique 가 막고 upsert 가 조용히 넘긴다
  ok((await proposeSellerNote(qProduct.id, "제안검증", null)).ok, "두 번 눌러도 오류가 아니다");
  let proposed = (await listProductProposals(qProduct.id)).find((p) => p.raw === "제안검증");
  ok(proposed?.agreeCount === 1, `같은 사람이 두 번 내도 동의는 1이다 (${proposed?.agreeCount})`);
  ok(proposed?.mine === true, "내가 낸 것으로 표시된다");

  // 다른 사람이 같은 표현을 내면 그것이 동의 2다. 표기가 흔들려도 같은 제안으로 묶여야 한다
  const other = await prisma.user.upsert({
    where: { id: "check-other" },
    update: {},
    create: { id: "check-other", displayName: "검증용", role: "USER" },
    select: { id: true },
  });
  await prisma.sellerNoteProposal.create({
    data: {
      productId: qProduct.id,
      raw: "제안 검증",
      normalizedRaw: normalizeName("제안검증"),
      nodeId: "black_tea",
      createdById: other.id,
    },
  });
  proposed = (await listProductProposals(qProduct.id)).find((p) => p.normalizedRaw === normalizeName("제안검증"));
  ok(proposed?.agreeCount === 2, `다른 사람이 내면 동의가 는다 (${proposed?.agreeCount})`);
  ok(proposed?.raw === "제안검증", "표시는 먼저 낸 사람의 표기를 쓴다");
  ok(proposed?.nodeId === "black_tea", "누구든 붙인 축이 있으면 그것을 쓴다");

  const pq = await listNoteProposals();
  const row = pq.find((p) => p.productId === qProduct.id && p.raw === "제안검증");
  ok(!!row, "어드민 큐에 뜬다");
  ok(row?.vendorName !== undefined && row?.productName !== undefined, "어느 원두인지 함께 온다");

  // 올리면 노트가 되고 제안은 큐에서 빠진다
  ok((await approveNoteProposal(qProduct.id, normalizeName("제안검증"))).ok, "노트로 올린다");
  ok(
    (await prisma.sellerNote.count({ where: { productId: qProduct.id, raw: "제안검증" } })) === 1,
    "올린 제안이 실제 노트가 된다",
  );
  ok(
    (await listProductProposals(qProduct.id)).every((p) => p.raw !== "제안검증"),
    "올린 제안은 큐에서 사라진다",
  );
  ok(!(await approveNoteProposal(qProduct.id, normalizeName("제안검증"))).ok, "두 번 못 올린다");

  // 거두기와 지우기
  await proposeSellerNote(qProduct.id, "거둘것", null);
  ok((await withdrawNoteProposal(qProduct.id, normalizeName("거둘것"))).ok, "낸 제안을 거둔다");
  ok(
    (await listProductProposals(qProduct.id)).every((p) => p.raw !== "거둘것"),
    "거두면 동의가 빠진다",
  );

  await proposeSellerNote(qProduct.id, "지울것", null);
  ok((await rejectNoteProposal(qProduct.id, normalizeName("지울것"))).ok, "어드민이 제안을 지운다");
  ok(
    (await listNoteProposals()).every((p) => p.raw !== "지울것"),
    "지운 제안은 큐에서 사라진다",
  );

  await prisma.sellerNoteProposal.deleteMany({ where: { productId: qProduct.id } });
  await prisma.user.deleteMany({ where: { id: "check-other" } });

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
