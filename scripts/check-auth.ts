// 가드가 실제로 **거절하는지** 본다.
//
// 나머지 검사 전량(vitest 74 · check 5 · e2e 24)이 시드 어드민으로 돈다. 그래서
// `guards.ts` 의 `user.role !== "ADMIN"` 한 줄을 지워도 전부 초록이다 — 어드민 표면
// 37개가 통째로 그 한 줄에 얹혀 있는데 그것을 지키는 검사가 없었다.
// `admin-actions.test.ts` 는 가드의 **문자열**이 제자리에 있는지만 본다 (설계 4-4).
//
// **역할을 뒤집는 것이 유일한 방법이다.** 1차 폴백(`identity.ts` 의 `?? SEED_ADMIN_ID`)이
// 세션 없는 호출을 전부 시드 어드민으로 만들기 때문에, 어드민이 아닌 사람을 만들려면
// 그 행의 role 을 바꾸는 수밖에 없다. 되돌리기는 finally 에 있다 —
// **이 스크립트가 도는 몇 초 동안은 dev 서버의 어드민 화면도 404 가 난다.**
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { issueInviteCode, listAccounts } from "../src/app/actions";
import { SEED_ADMIN_ID } from "../src/lib/auth/identity";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

let failed = 0;
const ok = (cond: boolean, label: string) => {
  if (!cond) failed += 1;
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
};

const TAG = "[가드검증]";

const setRole = (role: "USER" | "ADMIN") =>
  prisma.user.update({ where: { id: SEED_ADMIN_ID }, data: { role } });

async function main() {
  await prisma.inviteCode.deleteMany({ where: { label: { startsWith: TAG } } });
  try {
    await runChecks();
  } finally {
    // **원래 값이 아니라 ADMIN 으로 되돌린다.** 앞선 실행이 중간에 죽어 USER 로 남아
    // 있었다면 그 값을 복원하는 것은 고장을 복원하는 것이다. 시드 어드민은 어드민이다
    await setRole("ADMIN");
    await prisma.inviteCode.deleteMany({ where: { label: { startsWith: TAG } } });
  }
}

async function runChecks() {
  // 어드민일 때는 통과한다 — 이게 없으면 "항상 거절" 하는 가드도 아래를 통과시킨다
  ok((await issueInviteCode(`${TAG} 어드민`)).ok, "어드민은 통과한다");
  ok((await listAccounts()).length > 0, "어드민은 목록을 받는다");

  await setRole("USER");

  // AdminResult 를 반환하는 액션 — 거절이 값으로 나온다
  const denied = await issueInviteCode(`${TAG} 사용자`);
  ok(!denied.ok, "어드민이 아니면 AdminResult 액션이 거절된다");
  ok(
    !denied.ok && denied.message.includes("어드민"),
    "거절 이유가 '로그인 필요' 가 아니라 '어드민' 이다",
  );

  // **거절이 특권 작업보다 먼저 일어났는가.** 값만 보면 작업을 다 하고 나서
  // 거절을 반환하는 액션도 통과한다. 행이 안 생겼는지로 확인한다
  const leaked = await prisma.inviteCode.count({ where: { label: `${TAG} 사용자` } });
  ok(leaked === 0, "거절된 액션이 아무것도 만들지 않았다");

  // 데이터를 반환하는 목록 액션 — 거절이 throw 로 나온다 (RSC 렌더에서 불린다)
  let threw = false;
  try {
    await listAccounts();
  } catch (e) {
    threw = (e as Error).message.includes("어드민");
  }
  ok(threw, "어드민이 아니면 목록 액션이 던진다");

  if (failed > 0) {
    console.error(`\n${failed}건 실패`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
