import { expect, test } from "@playwright/test";

import {
  actUntil,
  cleanup,
  openSheet,
  prisma,
  seedProduct,
  seedRecord,
  TAG,
  typeInto,
} from "./helpers";

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

test("띠가 원두 정보 박스의 상단 경계에 붙는다", async ({ page }) => {
  const p = await seedProduct(
    "박스띠",
    [{ raw: "자스민", nodeId: "flower" }],
    { kind: "single", roastLevel: "LIGHT" },
  );
  await page.goto(`/products/${p.id}`);

  // 띠는 제목 아래 떠 있는 막대가 아니라 카드의 일부다 — 박스 안에 있어야 한다
  const box = page.locator("section", { has: page.getByRole("heading", { name: "원두 정보" }) });
  await expect(box.getByTestId("note-gradient")).toBeVisible();
});

test("기록 시트의 원두 정보에도 같은 띠가 뜬다", async ({ page }) => {
  const p = await seedProduct(
    "시트띠",
    [
      { raw: "자스민", nodeId: "flower" },
      { raw: "블루베리", nodeId: "berry" },
    ],
    { kind: "single", roastLevel: "LIGHT" },
  );
  await seedRecord(p.id, [{ sellerNoteId: p.sellerNotes[0].id, value: "STRONG" }]);

  await page.goto("/");
  await openSheet(page, p.name);

  // 판정을 매기는 자리에서도 이 원두의 프로필이 보인다. 원두 상세와 같은 띠다
  const band = page.getByTestId("note-gradient");
  await expect(band).toBeVisible();
  // 시트는 클라이언트에서 style 을 붙여 브라우저가 rgb 로 정규화한다.
  // 원두 상세는 서버 렌더라 hex 가 그대로 남는다 — 같은 색인데 표기가 다르다
  const style = await band.getAttribute("style");
  expect(style).toContain("rgb(211, 195, 164)");
  expect(style).toContain("rgb(177, 80, 63)");
});

test("색이 하나도 없으면 기록 시트도 띠를 안 그린다", async ({ page }) => {
  const p = await seedProduct("시트색없음", [{ raw: "누룩", nodeId: null }], {
    kind: "single",
    roastLevel: "LIGHT",
  });
  await seedRecord(p.id, []);

  await page.goto("/");
  await openSheet(page, p.name);

  await expect(page.getByText("누룩")).toBeVisible();
  await expect(page.getByTestId("note-gradient")).toHaveCount(0);
});
