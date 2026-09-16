// 별칭 한영 표기 병합 (mergeAlias, 2026-09-16).
//
// 병합은 소스 행을 지운다. 그런데 **판매자 노트는 별칭을 FK 가 아니라 raw 문자열로 가리킨다** —
// 지운 표기를 쓰는 노트가 남아 있고, 그 노트를 찾는 코드가 영문 칸을 안 보면 조용히 빠진다.
// 색 · 자동완성 · 재승인 · 옮기기 · 되돌리기가 전부 그 자리다. DB 로만 보인다.
import { AliasScope, Category, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import {
  attachNote,
  getProductDetail,
  mergeAlias,
  remapAlias,
  searchNoteSuggestions,
  unmapAlias,
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

// 기호를 안 쓴다 — normalizeName 이 걷어내 자동완성 질의가 어긋난다
const KO = "합치기검증향";
const EN = "Mergecheckscent";
const OTHER = "합치기검증다른향";
const PRODUCT = "[합치기검증] 원두";

async function cleanup() {
  await prisma.product.deleteMany({ where: { name: PRODUCT } });
  await prisma.noteAlias.deleteMany({ where: { raw: { in: [KO, EN, OTHER] } } });
}

const alias = (raw: string, nodeId: string, color: string | null = null) =>
  prisma.noteAlias.create({
    data: { raw, normalizedRaw: normalizeName(raw), nodeId, color, scope: AliasScope.PUBLIC },
    select: { id: true },
  });

const nodesOf = async (productId: string) =>
  (await prisma.sellerNote.findMany({ where: { productId }, select: { raw: true, nodeId: true } }))
    .map((n) => `${n.raw}:${n.nodeId}`)
    .sort();

async function main() {
  await cleanup();
  const vendor = await prisma.vendor.findFirst({ select: { id: true } });
  if (!vendor) throw new Error("Vendor 가 없다");

  const ko = await alias(KO, "citrus", "#abcdef");
  const en = await alias(EN, "citrus");
  const other = await alias(OTHER, "berry");

  // 한 원두에 두 표기가 함께 있다 — 옮기기 · 되돌리기가 둘 다 데려가는지 본다
  const notes = [
    { raw: KO, nodeId: "citrus" },
    { raw: EN, nodeId: "citrus" },
  ];
  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      category: Category.COFFEE,
      name: PRODUCT,
      normalizedName: normalizeName(PRODUCT),
      noteSetHash: computeNoteSetHash(notes),
      sellerNotes: { create: notes.map((n, i) => ({ ...n, position: i })) },
    },
    select: { id: true },
  });

  // ── 막는 경우
  ok(!(await mergeAlias(ko.id, other.id)).ok, "축이 다르면 못 합친다");
  ok(!(await mergeAlias(ko.id, en.id)).ok, "합칠 쪽에만 색이 있으면 못 합친다 — 색이 조용히 바뀐다");
  ok(!(await mergeAlias(ko.id, ko.id)).ok, "자기 자신과는 못 합친다");

  // ── 합친다: 영문을 한글 행에 흡수
  const merged = await mergeAlias(en.id, ko.id);
  ok(merged.ok, `영문 표기를 한글 행에 합친다${merged.ok ? "" : ` — ${merged.message}`}`);
  ok(!(await prisma.noteAlias.findUnique({ where: { id: en.id } })), "소스 행이 지워진다");
  const row = await prisma.noteAlias.findUniqueOrThrow({ where: { id: ko.id } });
  ok(row.rawEn === EN && row.normalizedEn === normalizeName(EN), "타깃의 영문 칸에 소스 표기가 들어간다");
  ok(!(await mergeAlias(other.id, ko.id)).ok, "이미 합쳐진 행에는 더 못 합친다");

  // ── 색: 영문 판매자 노트도 합쳐진 행의 색으로 칠해진다
  const detail = await getProductDetail(product.id);
  ok(
    detail?.notes.every((n) => n.nodeColor === "#abcdef") ?? false,
    "두 표기의 판매자 노트가 모두 합쳐진 행의 색으로 칠해진다",
  );

  // ── 자동완성: 영문 부분 일치가 살아 있고, 친 쪽 표기를 준다
  const hitsEn = await searchNoteSuggestions("mergecheck");
  ok(hitsEn.some((h) => h.raw === EN), "영문 부분 일치로 찾으면 영문 표기를 준다");
  const hitsKo = await searchNoteSuggestions("합치기검증향");
  ok(hitsKo.some((h) => h.raw === KO), "한글로 찾으면 한글 표기를 준다");

  // ── 재승인: 지운 표기가 새 행으로 되살아나지 않는다
  const again = await attachNote(EN, "citrus");
  ok(again.ok, "영문 표기를 다시 붙여도 성공한다");
  ok(
    (await prisma.noteAlias.count({ where: { raw: EN } })) === 0,
    "다시 붙여도 영문 표기가 새 행으로 생기지 않는다",
  );

  // ── 옮기기 · 되돌리기: 두 표기의 노트를 함께 데려간다
  const moved = await remapAlias(ko.id, "stone_fruit");
  ok(moved.ok, `합쳐진 행을 다른 축으로 옮긴다${moved.ok ? "" : ` — ${moved.message}`}`);
  ok(
    JSON.stringify(await nodesOf(product.id)) ===
      JSON.stringify([`${EN}:stone_fruit`, `${KO}:stone_fruit`].sort()),
    "옮기면 영문 표기의 판매자 노트도 함께 옮겨진다",
  );
  const unmapped = await unmapAlias(ko.id);
  ok(unmapped.ok, "합쳐진 행을 되돌린다");
  ok(
    (await nodesOf(product.id)).every((n) => n.endsWith(":null")),
    "되돌리면 영문 표기의 판매자 노트도 미매핑으로 간다",
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
