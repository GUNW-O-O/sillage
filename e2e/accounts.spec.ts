import { devices, expect, test } from "@playwright/test";

import { prisma, typeAndClick } from "./helpers";

// **데스크톱 뷰포트다.** 어드민은 PC 전용이고 반응형 대상이 아니다 (설계 7-4).
test.use({ ...devices["Desktop Chrome"] });

// 꼬리표를 **뒤에** 붙인다 (helpers.ts 의 TAG 와 같은 이유)
const LABEL = "김철수 [E2E계정]";

const cleanup = () =>
  prisma.inviteCode.deleteMany({ where: { label: { contains: "[E2E계정]" } } });

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("어드민이 초대 코드를 발급하고 폐기한다", async ({ page }) => {
  await page.goto("/admin/accounts");

  // 하이드레이션 전에는 onClick 이 안 붙어 클릭이 삼켜진다. 결과가 나올 때까지 다시 누른다
  await typeAndClick(page, "누구에게 주는 코드인가", LABEL, "발급", page.getByText(LABEL));

  const row = page.getByRole("row").filter({ hasText: LABEL });
  await expect(row).toBeVisible();
  await expect(row.getByText(/^[0-9]{6}$/)).toBeVisible();
  await expect(row.getByText("미사용")).toBeVisible();

  // "아직 없다." 는 DB 에 코드가 0건일 때만 뜬다 — 다른 실행이 남긴 무관한 코드가
  // 있으면 영영 안 떠서 타임아웃난다. 대신 이 행 자체가 사라지는 것으로 폐기를 확인한다.
  // 하이드레이션 전 클릭은 삼켜지므로 결과(행 소멸)가 나올 때까지 다시 누른다
  await expect(async () => {
    await page.getByRole("button", { name: `${LABEL} 코드 폐기`, exact: true }).click();
    await expect(row).toHaveCount(0);
  }).toPass({ timeout: 20_000 });
});
