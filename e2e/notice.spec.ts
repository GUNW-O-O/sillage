import { expect, test } from "@playwright/test";

import { prisma } from "./helpers";
import { SESSION_COOKIE, signSessionToken } from "../src/lib/auth/token";

const LABEL = "김철수 [E2E일반]";

const cleanup = async () => {
  // InviteCode → User 순서다. FK 가 그 방향으로 걸려 있다
  await prisma.inviteCode.deleteMany({ where: { label: { contains: "[E2E일반]" } } });
  await prisma.user.deleteMany({ where: { displayName: { contains: "[E2E일반]" } } });
};

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

// 없는 주소는 Next 기본 화면이 아니라 우리 화면이 나와야 한다.
test("없는 주소는 안내 화면으로 간다", async ({ page }) => {
  const res = await page.goto("/없는주소-e2e");

  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "찾는 페이지가 없어요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "목록으로" })).toBeVisible();
});

/// 어드민이 아닌 사람에게 `/admin` 이 무엇을 내는가 (설계 4-2).
///
/// **이 자리는 오래 재현이 안 됐다.** 전역 셋업도 폴백도 신원을 **어드민**으로 주므로
/// 가드가 거절할 일이 없었다. 세션을 USER 롤로 갈아 끼우면 그때 처음 보인다.
///
/// **403 이 아니라 404 여야 한다.** 403 은 "여기 어드민이 있다" 를 알려준다 — 없는 주소와
/// 글자 하나까지 같은 화면이 나오는 것이 요점이다.
///
/// 스위치(`AUTH_DISABLED=1`)와 무관하게 돈다. 쿠키가 있으면 폴백을 안 보기 때문이다
/// (`identity.ts` 의 `readSession() ?? ...`).
test("어드민이 아니면 /admin 이 없는 주소와 같은 화면을 낸다", async ({ page, context }) => {
  const user = await prisma.user.create({
    data: { displayName: LABEL, role: "USER" },
    select: { id: true },
  });
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: await signSessionToken(user.id),
      url: "http://localhost:3000",
    },
  ]);

  const res = await page.goto("/admin");

  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "찾는 페이지가 없어요" })).toBeVisible();
  // 사이드바가 보이면 가드가 안 선 것이다
  await expect(page.getByRole("link", { name: "미매핑" })).toHaveCount(0);
});
