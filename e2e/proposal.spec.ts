import { expect, test } from "@playwright/test";

import {
  addChip,
  cleanup,
  clickUntil,
  clickUntilDb,
  prisma,
  seedProduct,
  TAG,
  USER,
} from "./helpers";
import { normalizeName } from "../src/lib/normalize";

// 사용자가 내는 빠진 노트 제안 — 제안 · 동의 · 거두기.
// 어드민 쪽 승격과 기각은 admin.spec.ts 에 있다 (그쪽은 PC 전용이라 뷰포트가 다르다).
//
// 노트는 Product 동일성 키의 절반이라 사람마다 다르게 보일 수 없다 —
// 제안은 승격 전까지 어느 화면에도 노트로 안 나온다. 그 경계를 여기서 지킨다.

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("빠진 노트를 제안하면 노트가 아니라 제안으로 쌓인다", async ({ page }) => {
  const p = await seedProduct("시그마", [{ raw: "자스민", nodeId: "flower" }]);

  await page.goto(`/products/${p.id}`);
  await addChip(page, "봉투에 있는데 빠진 노트", "베르가못");
  await clickUntil(
    page.getByRole("button", { name: "1개 제안" }),
    page.getByText("동의 1"),
  );

  expect(await prisma.sellerNoteProposal.count({ where: { productId: p.id } })).toBe(1);
  // 승격 전에는 노트가 아니다
  expect(await prisma.sellerNote.count({ where: { productId: p.id } })).toBe(1);
});

test("다른 사람이 같은 표현을 내면 동의가 는다", async ({ page }) => {
  const p = await seedProduct("타우", [{ raw: "자스민", nodeId: "flower" }]);
  const other = await prisma.user.upsert({
    where: { id: "e2e-other" },
    update: {},
    create: { id: "e2e-other", displayName: `다른사람 ${TAG}`, role: "USER" },
    select: { id: true },
  });
  await prisma.sellerNoteProposal.create({
    data: {
      productId: p.id,
      raw: "베르가못",
      normalizedRaw: normalizeName("베르가못"),
      nodeId: "citrus",
      createdById: other.id,
    },
  });

  await page.goto(`/products/${p.id}`);
  // 남이 낸 제안에 "나도" 로 동의한다 — 이 버튼이 없으면 동의가 모일 경로가 없다
  await expect(page.getByText("동의 1")).toBeVisible();
  await clickUntil(page.getByRole("button", { name: "나도" }), page.getByText("동의 2"));

  expect(
    await prisma.sellerNoteProposal.count({
      where: { productId: p.id, normalizedRaw: normalizeName("베르가못") },
    }),
  ).toBe(2);

  await prisma.sellerNoteProposal.deleteMany({ where: { createdById: other.id } });
  await prisma.user.deleteMany({ where: { id: other.id } });
});

test("낸 제안을 거두면 동의가 빠진다", async ({ page }) => {
  const p = await seedProduct("입실론2", [{ raw: "자스민", nodeId: "flower" }]);
  await prisma.sellerNoteProposal.create({
    data: {
      productId: p.id,
      raw: "홍차",
      normalizedRaw: normalizeName("홍차"),
      nodeId: "black_tea",
      createdById: USER,
    },
  });

  await page.goto(`/products/${p.id}`);
  await clickUntilDb(
    page.getByRole("button", { name: "거두기" }),
    async () => (await prisma.sellerNoteProposal.count({ where: { productId: p.id } })) === 0,
  );
});
