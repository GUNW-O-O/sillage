// 향 계층의 전제들 (설계 2026-09-08).
//
// **이 설계 전체가 「옮기기는 공짜, 격하는 아니다」 위에 서 있다** (§7).
// 노드를 옮기는 것은 nodeId 가 그대로라 noteSetHash 가 안 움직이고, 별칭을 다른 축으로
// 격하하는 것은 nodeId 가 바뀌어 해시가 바뀌고 충돌할 수 있다. 그 차이 때문에
// 「지금 옮기고 나중에 다듬는다」가 성립한다 — 틀리면 재구성 계획 전체가 틀린다.
//
// 그리고 둘 다 **DB 로만 보인다.** 순수 함수 테스트는 해시 함수만 보고, e2e 는 화면만 본다.
import { AliasScope, Category, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import {
  getProductDetail,
  remapAlias,
  searchNoteSuggestions,
  updateFlavorNode,
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

const TAG = "[향계층검증]";
const NODE = "check_flavor_move";
const RAW = `${TAG}표현`;

async function cleanup() {
  await prisma.product.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.noteAlias.deleteMany({ where: { raw: RAW } });
  await prisma.flavorNode.deleteMany({ where: { id: NODE } });
}

const hashOf = async (id: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id }, select: { noteSetHash: true } }))
    .noteSetHash;

async function main() {
  await cleanup();
  const vendor = await prisma.vendor.findFirst({ select: { id: true } });
  if (!vendor) throw new Error("Vendor 가 없다");

  // 검증용 축을 따로 만든다. 실제 계층을 옮겼다가 되돌리면 스크립트가 중간에 죽었을 때
  // 트리가 어긋난 채로 남는다
  await prisma.flavorNode.create({
    data: { id: NODE, level: 2, parentId: "floral", labelKo: `${TAG}축`, labelEn: "Check Move" },
  });
  await prisma.noteAlias.create({
    data: { raw: RAW, normalizedRaw: normalizeName(RAW), nodeId: NODE, scope: AliasScope.PUBLIC },
  });

  const notes = [{ raw: RAW, nodeId: NODE }];
  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      category: Category.COFFEE,
      name: `${TAG} 원두`,
      normalizedName: normalizeName(`${TAG} 원두`),
      noteSetHash: computeNoteSetHash(notes),
      sellerNotes: { create: notes.map((n, i) => ({ ...n, position: i })) },
    },
    select: { id: true, noteSetHash: true },
  });

  // ── 옮기기는 공짜다 (설계 §7)
  const before = product.noteSetHash;
  const moved = await updateFlavorNode(NODE, "green_vegetative", `${TAG}축`, "Check Move", "");
  ok(moved.ok, `노드를 다른 L1 아래로 옮긴다${moved.ok ? "" : ` — ${moved.message}`}`);
  ok(
    (await prisma.flavorNode.findUniqueOrThrow({ where: { id: NODE }, select: { parentId: true } }))
      .parentId === "green_vegetative",
    "부모가 실제로 바뀐다",
  );
  ok(await hashOf(product.id) === before, "옮겨도 noteSetHash 가 안 바뀐다 — 소급이 없다");
  ok(
    (await prisma.sellerNote.findFirstOrThrow({ where: { productId: product.id }, select: { nodeId: true } }))
      .nodeId === NODE,
    "옮겨도 판매자 노트의 축은 그대로다",
  );

  // ── 계층은 두 단이다 (설계 §3). L2 아래로 옮기면 L3 가 생긴다
  const deep = await updateFlavorNode(NODE, "berry", `${TAG}축`, "Check Move", "");
  ok(!deep.ok, "L2 아래로는 못 옮긴다 — L3 를 만들지 않는다");
  const promote = await updateFlavorNode(NODE, null, `${TAG}축`, "Check Move", "");
  ok(!promote.ok, "레벨은 못 바꾼다 — 부모를 지워 L1 으로 올릴 수 없다");

  // ── 격하는 공짜가 아니다 (설계 §7)
  const alias = await prisma.noteAlias.findFirstOrThrow({ where: { raw: RAW }, select: { id: true } });
  const demoted = await remapAlias(alias.id, "berry");
  ok(demoted.ok, `별칭을 다른 축으로 옮긴다${demoted.ok ? "" : ` — ${demoted.message}`}`);
  ok(await hashOf(product.id) !== before, "격하하면 noteSetHash 가 바뀐다 — 충돌할 수 있다");
  ok(
    (await prisma.sellerNote.findFirstOrThrow({ where: { productId: product.id }, select: { nodeId: true } }))
      .nodeId === "berry",
    "격하는 과거 판매자 노트를 따라간다 — 소급한다",
  );

  // ── 색은 없으면 부모에서 상속한다 (설계 §6). 정책을 스키마에 안 굳힌 것이 이것이다 —
  //    `berry` 에는 색이 없고 부모 `fruity` 에만 있는데 노트는 색을 받아야 한다
  const detail = await getProductDetail(product.id);
  ok(detail?.notes[0]?.nodeColor === "#b1503f", "색이 없는 축은 부모 색을 물려받는다");

  await prisma.sellerNote.create({
    data: { productId: product.id, raw: `${TAG}미매핑`, nodeId: null, position: 1 },
  });
  const withUnmapped = await getProductDetail(product.id);
  ok(
    withUnmapped?.notes.find((n) => n.raw === `${TAG}미매핑`)?.nodeColor === null,
    "미매핑 노트는 색이 없다 — 회색으로 채우지 않는다",
  );

  // ── 색은 어드민이 덮어쓰고, 비우면 상속으로 돌아간다 (설계 §6).
  //    **되돌릴 수단이 없으면 한 번 잘못 넣은 색을 영영 못 뺀다.** 그래서 빈 문자열이
  //    「지운다」의 뜻인지를 여기서 지킨다 — 화면만으로는 확인이 안 되는 자리다
  const painted = await updateFlavorNode(NODE, "green_vegetative", `${TAG}축`, "Check Move", "#123456");
  ok(painted.ok, `색을 덮어쓴다${painted.ok ? "" : ` — ${painted.message}`}`);
  ok(
    (await prisma.flavorNode.findUniqueOrThrow({ where: { id: NODE }, select: { color: true } }))
      .color === "#123456",
    "덮어쓴 색이 노드에 남는다",
  );
  const cleared = await updateFlavorNode(NODE, "green_vegetative", `${TAG}축`, "Check Move", "");
  ok(cleared.ok, "색을 비운다");
  ok(
    (await prisma.flavorNode.findUniqueOrThrow({ where: { id: NODE }, select: { color: true } }))
      .color === null,
    "비우면 null 이 되어 부모에서 다시 물려받는다",
  );
  // 값이 그대로 style 에 들어가므로 형식을 막는다
  const bad = await updateFlavorNode(NODE, "green_vegetative", `${TAG}축`, "Check Move", "red");
  ok(!bad.ok, "hex 가 아닌 색은 거절한다");

  // ── 총칭이 갈 자리가 있다 (설계 §4). actions.ts 의 레벨 제한이 돌아오면 여기서 걸린다.
  // **`플로럴` 로는 이 검사가 안 된다** — 별칭 `Floral` 이 이미 L1 을 가리켜서
  // 노드 질의가 레벨에 갇혀 있어도 통과한다. 별칭이 없는 L1 라벨이라야 노드 질의만이 답한다
  ok(
    (await searchNoteSuggestions("단맛")).some((h) => h.nodeId === "sweet"),
    "자동완성이 L1 을 제안한다 — 총칭을 큰 갈래에 직접 붙일 수 있다",
  );
  ok(
    (await searchNoteSuggestions("플로럴")).some((h) => h.path === "꽃 · 차 > 화이트 플로럴"),
    "자동완성이 계층 경로를 함께 준다 — 큰 갈래와 세부가 구별된다",
  );

  // ── 트리 전체가 두 단인가
  const all = await prisma.flavorNode.findMany({ select: { id: true, level: true, parentId: true } });
  const byId = new Map(all.map((n) => [n.id, n]));
  ok(all.every((n) => n.level === 1 || n.level === 2), "레벨이 1 · 2 뿐이다");
  ok(
    all.every((n) => (n.level === 1 ? n.parentId === null : byId.get(n.parentId!)?.level === 1)),
    "L1 은 부모가 없고 L2 의 부모는 전부 L1 이다",
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
