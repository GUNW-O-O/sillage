import { expect, test } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// 원두 상세의 스펙 수정. **브라우저에서만 드러나는 것을 본다** —
// 이미 고른 나라 · 가공 · 품종이 수정 화면에서 통째로 사라져 보였던 버그가 여기 있었다.
// 서버 쪽은 멀쩡했고(parseAttributes 가 id 를 다 넘겼다) LookupPicker 가 그 id 의
// 이름을 몰라 선택 칩을 안 그렸다. 게다가 visible 이 selected 를 걸러내 후보 목록에서도
// 빠졌다. vitest 도 check-*.ts 도 못 보는 자리였다.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

test.afterAll(() => prisma.$disconnect());

/// 하이드레이션 전에 누르면 onClick 이 아직 안 붙어 클릭이 그냥 삼켜진다.
/// Playwright 는 요소가 보이면 바로 누르므로 **눌린 결과가 나올 때까지 다시 누른다.**
/// networkidle 은 못 쓴다 — dev 서버는 HMR 웹소켓이 계속 열려 있어 idle 이 안 온다
async function toggle(page: import("@playwright/test").Page, from: string, to: string) {
  await expect(async () => {
    await page.getByRole("button", { name: from }).click();
    await expect(page.getByRole("button", { name: to })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
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
