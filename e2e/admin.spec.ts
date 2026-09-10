import { devices, expect, test } from "@playwright/test";

import {
  addChip,
  cleanup,
  clickUntil,
  clickUntilDb,
  prisma,
  seedProduct,
  TAG,
  typeAndClick,
  USER,
} from "./helpers";
import { normalizeName } from "../src/lib/normalize";

// 어드민 화면 전량 — 제안 큐 · 미매핑 큐 · 원두 노트.
//
// **데스크톱 뷰포트로 돌린다.** 어드민은 PC 전용이고 반응형 대상이 아니다 (설계 7-4).
// 폰 폭에서는 220px 사이드바와 본문이 겹쳐 클릭이 가로막힌다 — 그것은 앱의 결함이 아니라
// 안 만들기로 한 화면 크기다.
test.use({ ...devices["Desktop Chrome"] });

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("어드민이 제안을 노트로 올린다", async ({ page }) => {
  const p = await seedProduct("파이", [{ raw: "자스민", nodeId: "flower" }]);
  await prisma.sellerNoteProposal.create({
    data: {
      productId: p.id,
      raw: `핵과 ${TAG}`,
      normalizedRaw: normalizeName(`핵과 ${TAG}`),
      nodeId: "stone_fruit",
      createdById: USER,
    },
  });

  await page.goto("/admin/proposals");
  await expect(page.getByText(`핵과 ${TAG}`)).toBeVisible();
  await clickUntilDb(
    page.getByRole("button", { name: "노트로 올리기" }),
    async () => (await prisma.sellerNote.count({ where: { productId: p.id } })) === 2,
  );

  expect(await prisma.sellerNoteProposal.count({ where: { productId: p.id } })).toBe(0);
});

test("어드민이 제안을 지운다", async ({ page }) => {
  const p = await seedProduct("로", [{ raw: "자스민", nodeId: "flower" }]);
  await prisma.sellerNoteProposal.create({
    data: {
      productId: p.id,
      raw: `쥬시 ${TAG}`,
      normalizedRaw: normalizeName(`쥬시 ${TAG}`),
      nodeId: null,
      createdById: USER,
    },
  });

  page.on("dialog", (d) => d.accept());
  await page.goto("/admin/proposals");
  await clickUntilDb(
    page.getByRole("button", { name: "지우기" }),
    async () => (await prisma.sellerNoteProposal.count({ where: { productId: p.id } })) === 0,
  );
  // 지운 제안은 노트가 되지 않는다
  expect(await prisma.sellerNote.count({ where: { productId: p.id } })).toBe(1);
});

test("미매핑 큐에서 raw 에 축을 붙이면 판매자 노트와 내 기록이 함께 붙는다", async ({ page }) => {
  const raw = `젖은판지 ${TAG}`;
  const p = await seedProduct("업실론", [{ raw, nodeId: null }]);
  const exp = await prisma.experience.create({
    data: { userId: USER, productId: p.id, extraNotes: { create: [{ raw, nodeId: null }] } },
    select: { id: true },
  });

  await page.goto("/admin/unmapped");
  await expect(page.getByText(raw).first()).toBeVisible();
  // 출처가 구분돼 보인다 — 판매자의 주장인지 내가 느낀 것인지
  await expect(page.getByText("내 기록").first()).toBeVisible();

  await clickUntil(
    page.getByRole("row").filter({ hasText: raw }).getByRole("button", { name: "붙이기" }),
    page.getByText("어느 축에 붙일까"),
  );
  // 모달의 L2 칩을 누르는 순간 붙는다. 확인 버튼이 따로 없다
  await clickUntilDb(
    // 축의 라벨이 `홍차` 에서 `차` 로 넓어졌다 (설계 2026-09-08 §5). id 는 그대로다
    page.getByRole("button", { name: "차", exact: true }),
    async () =>
      (await prisma.sellerNote.count({ where: { productId: p.id, nodeId: "black_tea" } })) === 1,
  );

  // 같은 표현의 내가 느낀 향도 함께 붙는다 — 사전이 하나이므로 결과도 하나여야 한다
  const extra = await prisma.extraNote.findFirstOrThrow({
    where: { experienceId: exp.id },
    select: { nodeId: true },
  });
  expect(extra.nodeId).toBe("black_tea");
});

test("미매핑 큐에서 향미가 아닌 표현을 지운다", async ({ page }) => {
  const raw = `클린컵 ${TAG}`;
  const p = await seedProduct("오미크론", [
    { raw: "자스민", nodeId: "flower" },
    { raw, nodeId: null },
  ]);

  page.on("dialog", (d) => d.accept());
  await page.goto("/admin/unmapped");
  await clickUntilDb(
    page.getByRole("row").filter({ hasText: raw }).getByRole("button", { name: "지우기" }),
    async () => (await prisma.sellerNote.count({ where: { productId: p.id } })) === 1,
  );
});

test("어드민이 원두를 찾아 노트를 추가한다", async ({ page }) => {
  const p = await seedProduct("프시", [{ raw: "자스민", nodeId: "flower" }]);

  await page.goto("/admin/products");
  await typeAndClick(page, "원두명 검색", "프시", "찾기", page.getByRole("button", { name: p.name }));
  await clickUntil(
    page.getByRole("button", { name: p.name }),
    page.getByPlaceholder("봉투에 적힌 노트를 하나씩"),
  );

  await addChip(page, "봉투에 적힌 노트를 하나씩", "홍차");
  await clickUntilDb(
    page.getByRole("button", { name: "1개 추가" }),
    async () => (await prisma.sellerNote.count({ where: { productId: p.id } })) === 2,
  );
});

test("판정이 붙은 노트는 어드민도 못 지운다", async ({ page }) => {
  const p = await seedProduct("오메가", [
    { raw: "자스민", nodeId: "flower" },
    { raw: "청사과", nodeId: "other_fruit" },
  ]);
  const exp = await prisma.experience.create({
    data: { userId: USER, productId: p.id },
    select: { id: true },
  });
  await prisma.noteHit.create({
    data: { experienceId: exp.id, sellerNoteId: p.sellerNotes[0].id, value: "STRONG" },
  });

  await page.goto("/admin/products");
  await typeAndClick(page, "원두명 검색", "오메가", "찾기", page.getByRole("button", { name: p.name }));
  await clickUntil(
    page.getByRole("button", { name: p.name }),
    page.getByRole("row").filter({ hasText: "자스민" }),
  );

  // 왜 안 되는지를 먼저 보여준다 — 눌러보고 실패하게 두지 않는다
  const row = page.getByRole("row").filter({ hasText: "자스민" });
  await expect(row.getByRole("button", { name: "지우기" })).toBeDisabled();
  expect(await prisma.sellerNote.count({ where: { productId: p.id } })).toBe(2);
});
