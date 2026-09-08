import { expect, test } from "@playwright/test";

import { actUntil, prisma, typeAndClickUntilDb, typeInto } from "./helpers";

// 초대 코드 교환 (설계 10-3).
//
// **성공 경로는 여기서만 볼 수 있다.** 교환이 성공하면 세션 쿠키를 굽는데, 쿠키를 구우려면
// 요청 컨텍스트가 필요하다 — `scripts/check-*.ts` 는 Node 라 그 경로에 원리적으로 못 간다.
// 거기서 보는 것은 거절과 시도 제한이고, 규칙 자체는 `isLockedOut` 테스트가 본다.
//
// 꼬리표를 **뒤에** 붙인다 (helpers.ts 의 TAG 와 같은 이유)
const LABEL = "박영희 [E2E교환]";

// **전역 셋업의 세션을 버린다** (session-setup.ts). 이 스펙이 보는 것은 「세션이 없는
// 사람이 코드를 넣어 들어온다」이고, 쿠키를 들고 `/join` 에 가면 그 경로가 아니다 —
// 교환 뒤의 이동이 이미 로그인된 상태에서만 확인돼 실제로 막히는 것을 못 봤다.
test.use({ storageState: { cookies: [], origins: [] } });

const cleanup = async () => {
  // InviteCode → User 순서다. FK 가 그 방향으로 걸려 있다
  await prisma.inviteCode.deleteMany({ where: { label: { contains: "[E2E교환]" } } });
  await prisma.user.deleteMany({ where: { displayName: { contains: "[E2E교환]" } } });
  // **ip 를 안 걸고 통째로 지운다.** dev 서버가 `x-forwarded-for: 127.0.0.1` 을 붙여서
  // 값이 환경마다 다르고, 무엇보다 **남기면 다음 실행이 잠긴다** — 잠금 창이 15분이라
  // 연달아 돌리면 두 번째 실행이 시도 제한에 걸린다.
  // 이 테이블은 원래 정상 사용에서 비어 있다 (설계 10-4)
  await prisma.inviteAttempt.deleteMany({});
};

/// DB 에 없는 6자리. **아무거나 고르면 안 된다** — 개발 중 발급해 둔 진짜 코드를 집으면
/// 성공 테스트는 남의 코드를 소진시키고, 실패 테스트는 뜻밖에 성공한다
async function absentCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!(await prisma.inviteCode.findUnique({ where: { code }, select: { id: true } }))) {
      return code;
    }
  }
  throw new Error("빈 코드를 못 찾았다");
}

/// 이 실행에서만 쓸 코드를 하나 발급한다
async function issueCode(): Promise<string> {
  const admin = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const code = await absentCode();
  await prisma.inviteCode.create({
    data: {
      code,
      label: LABEL,
      createdById: admin.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return code;
}

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("초대 코드를 교환하면 계정이 생기고 목록으로 들어간다", async ({ page }) => {
  const code = await issueCode();
  await page.goto("/join");

  // **교환은 멱등이 아니다.** 두 번째 호출은 소진된 코드로 거절되므로 계정이 둘 생기지는
  // 않지만, 다시 누를지를 화면으로 판단하면 리다이렉트 타이밍에 걸린다 — DB 로 본다
  await typeAndClickUntilDb(
    page,
    "000000",
    code,
    "시작",
    async () =>
      (await prisma.user.count({ where: { displayName: LABEL } })) > 0,
  );

  // label 이 그대로 표시명이 된다. 교환 화면에 이름 칸이 없는 이유다 (설계 5-3)
  const user = await prisma.user.findFirstOrThrow({
    where: { displayName: LABEL },
    select: { id: true, role: true },
  });
  expect(user.role).toBe("USER");

  // 소진을 「누가 · 언제」로 적는다 (설계 5-4 · 10-5). 둘은 항상 같이 채워진다
  const used = await prisma.inviteCode.findFirstOrThrow({
    where: { label: LABEL },
    select: { usedByUserId: true, usedAt: true },
  });
  expect(used.usedByUserId).toBe(user.id);
  expect(used.usedAt).not.toBeNull();

  // 성공하면 그 IP 의 실패 기록을 지운다 (설계 10-4)
  expect(await prisma.inviteAttempt.count()).toBe(0);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("아직 기록이 없어요.")).toBeVisible();
});

test("틀린 코드는 거절하고 화면에 남는다", async ({ page }) => {
  await issueCode();
  const wrong = await absentCode();
  await page.goto("/join");

  // **여기서는 DB 로 재시도를 판단하면 안 된다.** 실패도 행을 남기므로 조건이 첫 시도에
  // 참이 되지만, 그 전에 하이드레이션이 늦으면 재시도가 계속 돌아 **자기 자신을 잠근다**
  // (실제로 10건까지 갔다). 화면에 뜨는 오류 문구를 조건으로 쓰면 성공 즉시 멈춘다
  const rejected = page.getByText("코드가 맞지 않아요");
  await actUntil(async () => {
    await typeInto(page, "000000", wrong);
    await page.getByRole("button", { name: "시작", exact: true }).click({ timeout: 2000 });
  }, rejected);

  await expect(rejected).toBeVisible();
  // 실패가 시도 행으로 남는다 (설계 10-4). 재시도가 몇 번 돌았는지는 모르므로 하한만 본다
  expect(await prisma.inviteAttempt.count()).toBeGreaterThan(0);
  // 계정이 생기지 않았다. 리다이렉트도 없다
  expect(await prisma.user.count({ where: { displayName: LABEL } })).toBe(0);
  await expect(page).toHaveURL(/\/join$/);
});
