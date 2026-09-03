import { expect, test } from "@playwright/test";

// 없는 주소는 Next 기본 화면이 아니라 우리 화면이 나와야 한다.
// **어드민 레이아웃의 `notFound()` 도 같은 화면으로 떨어진다** — 그쪽은 지금 재현이 안 된다.
// 1차 폴백이 세션 없는 요청을 시드 어드민으로 만들어 가드가 통과하기 때문이다.
test("없는 주소는 안내 화면으로 간다", async ({ page }) => {
  const res = await page.goto("/없는주소-e2e");

  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "찾는 페이지가 없어요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "목록으로" })).toBeVisible();
});
