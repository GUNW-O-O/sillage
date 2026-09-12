import { expect, test } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { cleanup, clickUntil, icon, seedProduct, typeInto } from "./helpers";

// 원두 상세의 스펙 수정. **브라우저에서만 드러나는 것을 본다** —
// 이미 고른 나라 · 가공 · 품종이 수정 화면에서 통째로 사라져 보였던 버그가 여기 있었다.
// 서버 쪽은 멀쩡했고(parseAttributes 가 id 를 다 넘겼다) LookupPicker 가 그 id 의
// 이름을 몰라 선택 칩을 안 그렸다. 게다가 visible 이 selected 를 걸러내 후보 목록에서도
// 빠졌다. vitest 도 check-*.ts 도 못 보는 자리였다.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

async function toggle(page: import("@playwright/test").Page, from: string, to: string) {
  await clickUntil(icon(page, from), icon(page, to));
}

test("스펙 수정을 열면 이미 고른 나라 · 가공 · 품종이 보인다", async ({ page }) => {
  // 나라 · 가공 · 품종이 다 붙은 싱글 오리진을 고른다
  const product = await prisma.product.findFirstOrThrow({
    where: {
      AND: [
        { attributes: { path: ["countryId"], not: Prisma.DbNull } },
        { attributes: { path: ["processId"], not: Prisma.DbNull } },
      ],
    },
    select: { id: true, attributes: true },
  });

  const attrs = product.attributes as {
    countryId?: string;
    processId?: string;
    varietyIds?: string[];
  };
  const ids = [attrs.countryId, attrs.processId, ...(attrs.varietyIds ?? [])].filter(
    (x): x is string => !!x,
  );
  const names = await prisma.lookupValue.findMany({
    where: { id: { in: ids } },
    select: { nameKo: true },
  });
  expect(names.length).toBeGreaterThan(0);

  await page.goto(`/products/${product.id}`);
  await toggle(page, "원두 정보 수정", "수정 취소");

  // 선택 칩은 강조색 배경이다. 이름이 화면 어딘가 있는 것으로는 부족하다 —
  // 후보 목록에 우연히 같은 이름이 떠 있을 수 있다
  for (const { nameKo } of names) {
    await expect(
      page.locator("button.bg-accent").filter({ hasText: nameKo }),
      `“${nameKo}” 가 선택된 칩으로 보여야 한다`,
    ).toBeVisible();
  }
});

test("취소하면 편집을 버리고 저장값으로 돌아온다", async ({ page }) => {
  const product = await prisma.product.findFirstOrThrow({
    where: { attributes: { path: ["countryId"], not: Prisma.DbNull } },
    select: { id: true },
  });

  await page.goto(`/products/${product.id}`);
  const before = await page.locator("dl").innerText();

  await toggle(page, "원두 정보 수정", "수정 취소");
  await toggle(page, "수정 취소", "원두 정보 수정");

  // innerText 끼리 견준다. toHaveText 는 공백 정규화가 달라 같은 화면도 다르게 읽는다
  await expect
    .poll(() => page.locator("dl").innerText())
    .toBe(before);
});

// 「Geisha」를 쳤을 때 목록에 「게이샤」만 뜨면 그게 내가 찾던 것인지 알 수 없어
// 옆의 「추가」를 누르게 된다 — 그렇게 같은 품종이 두 행으로 앉았다
// (실제로 `워시드`(Washed) 옆에 `Washed` 가 따로 있었다).
//
// **브라우저에서만 드러난다.** 서버는 `createLookup` 이 기존 행을 돌려주므로 데이터가
// 안 갈리지만, 「추가」 버튼이 뜨느냐와 영문 이름이 보이느냐는 클라이언트 판정이다.
test("영문 이름으로 찾아도 이미 있는 품종이 그렇게 보이고, 추가가 안 뜬다", async ({ page }) => {
  const 게이샤 = await prisma.lookupValue.findFirstOrThrow({
    where: { kind: "VARIETY", nameKo: "게이샤" },
    select: { nameEn: true },
  });
  expect(게이샤.nameEn).toBe("Geisha");

  // **아무 원두나 집으면 안 된다.** 그 원두에 게이샤가 이미 골라져 있으면 화면에
  // `게이샤 ×` 칩이 서고, 검색 결과를 찾는 로케이터가 그 칩을 먼저 잡는다.
  // 어느 원두가 first 인지는 물리 행 순서라 검사 스크립트가 원두를 만들고 지우면 바뀐다 —
  // 실제로 그렇게 드러났다. 스펙이 제 입력을 만든다
  const product = await seedProduct("품종검색", [{ raw: "자스민", nodeId: "flower" }]);
  await page.goto(`/products/${product.id}`);
  await toggle(page, "원두 정보 수정", "수정 취소");

  // 하이드레이션 전 타이핑은 React 상태에 안 들어가 후보가 영영 안 뜬다.
  // 후보가 보일 때까지 다시 친다 (helpers.ts 의 actUntil 과 같은 사정)
  const option = page.getByRole("button", { name: /게이샤/ });
  await expect(async () => {
    await typeInto(page, "품종 검색", "Geisha");
    await expect(option.first()).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });

  // 검색 결과에는 한글과 영문이 나란히 선다 — 그래야 이게 그거인 줄 안다
  await expect(option.first()).toContainText("게이샤");
  await expect(option.first()).toContainText("Geisha");

  // **추가 버튼이 뜨면 안 된다.** 여기가 원래 뚫려 있던 자리다
  await expect(page.getByRole("button", { name: /추가/ })).toHaveCount(0);
});
