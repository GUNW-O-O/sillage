import { expect, test } from "@playwright/test";

import { actUntil, cleanup, prisma, seedProduct, TAG, typeInto } from "./helpers";

// 향 계층이 화면에서 성립하는가 (설계 2026-09-08 §9).
//
// **여기서만 보이는 것들이다.** 자동완성 목록은 클라이언트 상태고, 그라데이션은 노트 색을
// 이어 붙인 결과라 DB 검사로는 둘 다 안 보인다. `scripts/check-flavor.ts` 는 그 아래층
// (해시 · 상속 · 질의)을 본다.

const NOTE = "봉투에 적힌 노트를 하나씩";

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const openForm = async (page: import("@playwright/test").Page) => {
  const vendor = await prisma.vendor.findFirstOrThrow({ select: { id: true } });
  await page.goto(`/products/new?vendorId=${vendor.id}`);
  await expect(page.getByRole("heading", { name: "원두 등록" })).toBeVisible();
};

test("자동완성이 계층 경로를 보여준다", async ({ page }) => {
  await openForm(page);

  // 큰 갈래와 세부가 한 목록에 섞이므로 어디에 붙는지가 보여야 한다
  await actUntil(
    () => typeInto(page, NOTE, "플로럴"),
    page.getByText("꽃 · 차 > 화이트 플로럴"),
  );
});

test("총칭을 큰 갈래에 직접 붙인다", async ({ page }) => {
  await openForm(page);

  // `단맛` 은 어떤 향의 이름이 아니라 카테고리 이름 자체다. 흑설탕도 카라멜도 아닌 것을
  // 하위에 앉히면 없는 정보를 내려보내는 것이라 L1 에 직접 붙는다 (설계 §4)
  await actUntil(async () => {
    await typeInto(page, NOTE, "단맛");
    await page.getByRole("button", { name: "단맛", exact: true }).click({ timeout: 2000 });
  }, page.getByRole("button", { name: "단맛 ×" }));

  await page.getByPlaceholder("봉투에 적힌 그대로").fill(`총칭 ${TAG}`);
  await actUntil(
    () => page.getByRole("button", { name: "등록하고 기록하기" }).click({ timeout: 2000 }),
    page.getByRole("link", { name: "기록 입력", exact: true }),
  );

  const created = await prisma.product.findFirstOrThrow({
    where: { name: `총칭 ${TAG}` },
    select: { sellerNotes: { select: { raw: true, nodeId: true } } },
  });
  expect(created.sellerNotes).toEqual([{ raw: "단맛", nodeId: "sweet" }]);
});

test("원두 상세가 노트 색을 이어 그라데이션을 그린다", async ({ page }) => {
  const p = await seedProduct("그라데이션", [
    // 색이 노드에 직접 있는 축과, 부모에서 물려받는 축을 섞는다
    { raw: "자스민", nodeId: "flower" },
    { raw: "블루베리", nodeId: "berry" },
  ]);
  await page.goto(`/products/${p.id}`);

  const band = page.locator('[aria-hidden][style*="linear-gradient"]');
  await expect(band).toBeVisible();
  const style = await band.getAttribute("style");
  // 화이트 플로럴의 제 색과, berry 가 부모 `과일` 에서 물려받은 색이 순서대로 들어간다
  expect(style).toContain("#d3c3a4");
  expect(style).toContain("#b1503f");
});

test("붙은 축이 하나도 없으면 띠를 안 그린다", async ({ page }) => {
  const p = await seedProduct("색없음", [{ raw: "누룩", nodeId: null }]);
  await page.goto(`/products/${p.id}`);

  await expect(page.getByRole("heading", { name: p.name })).toBeVisible();
  // 없는 색을 회색으로 채우면 「회색인 향」처럼 보인다 — 아예 안 그린다 (설계 §6 미결 해소)
  await expect(page.locator('[aria-hidden][style*="linear-gradient"]')).toHaveCount(0);
});
