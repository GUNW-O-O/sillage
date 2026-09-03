import { devices, expect, test } from "@playwright/test";

import { clickUntilDb, prisma, typeAndClickUntilDb } from "./helpers";

// **데스크톱 뷰포트다.** 어드민은 PC 전용이고 반응형 대상이 아니다 (설계 7-4).
test.use({ ...devices["Desktop Chrome"] });

// 꼬리표를 **뒤에** 붙인다 (helpers.ts 의 TAG 와 같은 이유)
const LABEL = "김철수 [E2E계정]";

const codes = () => prisma.inviteCode.count({ where: { label: LABEL } });

const cleanup = () =>
  prisma.inviteCode.deleteMany({ where: { label: { contains: "[E2E계정]" } } });

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("어드민이 초대 코드를 발급하고 폐기한다", async ({ page }) => {
  await page.goto("/admin/accounts");

  // 하이드레이션 전에는 onClick 이 안 붙어 클릭이 삼켜진다. 그래서 다시 눌러야 하는데
  // **발급은 멱등이 아니다** — 다시 누를지를 화면이 아니라 DB 로 판단한다 (helpers.ts)
  await typeAndClickUntilDb(page, "누구에게 주는 코드인가", LABEL, "발급", async () => (await codes()) > 0);

  // 재시도가 두 장을 만들지 않았다. 이걸 안 보면 중복은 다음 단정의 strict mode 위반으로
  // 나타나 원인이 발급이 아니라 화면인 것처럼 읽힌다
  expect(await codes()).toBe(1);

  const row = page.getByRole("row").filter({ hasText: LABEL });
  await expect(row).toBeVisible();
  await expect(row.getByText(/^[0-9]{6}$/)).toBeVisible();
  await expect(row.getByText("미사용")).toBeVisible();

  // 폐기도 화면이 아니라 DB 로 본다. 목록이 비었는지로 보면 다른 실행이 남긴 무관한
  // 코드에 걸리고, 행이 사라지는 것으로 보면 갱신이 늦을 때 실패로 읽힌다
  await clickUntilDb(
    page.getByRole("button", { name: `${LABEL} 코드 폐기`, exact: true }),
    async () => (await codes()) === 0,
  );
  await expect(row).toHaveCount(0);
});
