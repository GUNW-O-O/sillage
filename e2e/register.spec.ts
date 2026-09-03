import { expect, test } from "@playwright/test";

import { addChip, cleanup, clickUntil, icon, prisma, seedProduct, TAG } from "./helpers";

// `+` 에서 시작하는 흐름 전량 — 통합 검색 · 로스터리 추가 · 원두 등록 · 취소.
// 등록 폼은 타이핑이 길어 시트가 아니라 라우트다. 잃으면 손해가 큰 자리라 취소도 확인한다.

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const openAdd = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await clickUntil(icon(page, "원두 추가"), page.getByPlaceholder("로스터리 · 원두 검색"));
};

test("두 글자 미만이면 검색이 안 나간다", async ({ page }) => {
  await openAdd(page);
  await page.getByPlaceholder("로스터리 · 원두 검색").fill("커");
  await expect(page.getByText("2글자 이상 입력해 주세요")).toBeVisible();
});

test("로스터리를 안 고르고 원두 이름으로 바로 기록에 간다", async ({ page }) => {
  const p = await seedProduct("이오타", [{ raw: "자스민", nodeId: "flower" }]);

  await openAdd(page);
  await page.getByPlaceholder("로스터리 · 원두 검색").fill("이오타");

  // 원두 섹션에 로스터리명이 함께 나온다 — 원두 이름은 전역 유일하지 않다
  const row = page.getByRole("button", { name: p.name });
  await expect(row).toBeVisible();
  await expect(page.getByText(p.vendorName).first()).toBeVisible();

  await clickUntil(row, page.getByRole("button", { name: "기록 저장" }));
  expect(page.url()).toContain(`/products/${p.id}/record`);
});

test("로스터리를 고르면 그 안의 원두 목록으로 간다", async ({ page }) => {
  const p = await seedProduct("카파", [{ raw: "자스민", nodeId: "flower" }]);

  await openAdd(page);
  await page.getByPlaceholder("로스터리 · 원두 검색").fill(p.vendorName);

  await clickUntil(
    page.getByRole("button", { name: p.vendorName, exact: true }),
    page.getByPlaceholder("원두명 검색"),
  );
  // 고른 로스터리가 상단에 남는다 — 지금 어느 로스터리 안인지가 보여야 한다
  await expect(page.getByText("로스터리", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: p.name })).toBeVisible();
});

test("없는 로스터리를 그 자리에서 만들고 원두를 등록한다", async ({ page }) => {
  const vendorName = `람다로스터스 ${TAG}`;

  await openAdd(page);
  await page.getByPlaceholder("로스터리 · 원두 검색").fill(vendorName);

  await clickUntil(
    page.getByRole("button", { name: `로스터리 “${vendorName}” 추가` }),
    page.getByPlaceholder("원두명 검색"),
  );

  // 결과가 없으니 등록으로 넘어간다
  await page.getByPlaceholder("원두명 검색").fill(`뮤 ${TAG}`);
  await clickUntil(
    page.getByRole("button", { name: "새 원두 등록" }),
    page.getByRole("heading", { name: "원두 등록" }),
  );

  // 제품명은 검색어가 그대로 넘어온다. 노트 1개만 있으면 저장된다
  await expect(page.getByPlaceholder("봉투에 적힌 그대로")).toHaveValue(`뮤 ${TAG}`);
  await addChip(page, "봉투에 적힌 노트를 하나씩", "자스민");

  await clickUntil(
    page.getByRole("button", { name: "등록하고 기록하기" }),
    page.getByRole("link", { name: "기록 입력", exact: true }),
  );

  const created = await prisma.product.findFirstOrThrow({
    where: { name: `뮤 ${TAG}` },
    select: { sellerNotes: { select: { raw: true } }, vendor: { select: { name: true } } },
  });
  expect(created.vendor.name).toBe(vendorName);
  expect(created.sellerNotes.map((n) => n.raw)).toEqual(["자스민"]);

  // 등록과 기록은 끊기지 않는다 (요구 FR-4)
  await clickUntil(
    page.getByRole("link", { name: "기록 입력", exact: true }),
    page.getByRole("button", { name: "기록 저장" }),
  );
});

test("등록 화면에서 취소하면 입력을 버리고 목록으로 돌아온다", async ({ page }) => {
  const vendor = await prisma.vendor.findFirstOrThrow({ select: { id: true } });

  page.on("dialog", (d) => d.accept());
  await page.goto(`/products/new?vendorId=${vendor.id}`);
  await expect(page.getByRole("heading", { name: "원두 등록" })).toBeVisible();

  await page.getByPlaceholder("봉투에 적힌 그대로").fill(`버릴것 ${TAG}`);
  await clickUntil(
    page.getByRole("button", { name: "취소", exact: true }),
    page.getByRole("heading", { name: "실라주" }),
  );

  expect(await prisma.product.count({ where: { name: `버릴것 ${TAG}` } })).toBe(0);
});

test("제품명과 노트가 없으면 저장 버튼이 안 눌린다", async ({ page }) => {
  const vendor = await prisma.vendor.findFirstOrThrow({ select: { id: true } });

  await page.goto(`/products/new?vendorId=${vendor.id}`);
  await expect(page.getByRole("button", { name: "등록하고 기록하기" })).toBeDisabled();
  await expect(page.getByText("제품명과 노트 1개만 있으면 저장돼요")).toBeVisible();
});
