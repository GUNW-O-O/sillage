// 초대 코드 — 두 갈래를 본다.
//
// **DB 제약 자체** (11건 중 2건): 액션을 거치지 않고 raw prisma 로 직접 찌른다 —
// 같은 code 중복 생성, 같은 usedByUserId 로 두 번 소진. 스키마에서 그 `@unique` 를
// 지우면 이 둘만 FAIL 로 뒤집힌다.
//
// **액션의 거절** (나머지 9건): issueInviteCode · revokeInviteCode 안의 `if` 문이
// 실제로 막는지 보는 통합 검사다. label 에는 CHECK 제약이 없고, 소진된 InviteCode 를
// 지워도 FK 위반이 나지 않는다(참조가 User 쪽으로만 나간다) — 이 아홉은 액션의 JS 가드를
// 지우면 FAIL 로 뒤집히지만 DB 제약과는 무관하다. 그래도 지울 가치는 없다: 이 액션들이
// 실제로 거절하는지를 보는 유일한 자리다.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { issueInviteCode, listInviteCodes, revokeInviteCode } from "../src/app/actions";
import { INVITE_TTL_MS } from "../src/lib/auth/invite-code";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

let failed = 0;
const ok = (cond: boolean, label: string) => {
  if (!cond) failed += 1;
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
};

const TAG = "[초대검증]";

async function cleanup() {
  await prisma.inviteCode.deleteMany({ where: { label: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { displayName: { startsWith: TAG } } });
}

async function main() {
  await cleanup();
  // 이 아래에서 예상 못한 예외가 나도(assert 실패가 아니라 throw) cleanup 은 돈다 —
  // try/catch 로 잡는 두 DB 확률 검사 말고는 전부 바깥 main().catch() 로 새는데,
  // 거길 거치면 아래 trailing cleanup() 이 건너뛰어져 검증용 행이 남는다.
  // finally 로 옮겨 실패 경로에서도 InviteCode → User 순서(FK 방향)로 청소되게 한다.
  try {
    await runChecks();
  } finally {
    await cleanup();
  }
}

async function runChecks() {
  ok((await issueInviteCode(`${TAG} 김철수`)).ok, "코드를 발급한다");

  const mine = (await listInviteCodes()).filter((r) => r.label.startsWith(TAG));
  ok(mine.length === 1, "발급한 코드가 목록에 뜬다");
  ok(/^[0-9]{6}$/.test(mine[0].code), "6자리 숫자다");
  ok(!mine[0].expired && mine[0].usedBy === null, "새 코드는 미만료 · 미소진이다");

  const ttl = mine[0].expiresAt.getTime() - mine[0].createdAt.getTime();
  ok(Math.abs(ttl - INVITE_TTL_MS) < 5000, "만료가 24시간 뒤다");

  ok(!(await issueInviteCode("   ")).ok, "빈 label 은 거절한다");

  // 같은 code 를 두 번 넣으면 DB 가 막는다 — 액션의 재시도가 기대는 제약이다
  let dup = false;
  try {
    await prisma.inviteCode.create({
      data: {
        code: mine[0].code,
        label: `${TAG} 중복`,
        createdById: "seed-admin",
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
  } catch {
    dup = true;
  }
  ok(dup, "같은 코드는 DB 가 막는다");

  // 소진된 코드는 못 지운다 — 계정이 어떤 초대로 들어왔는지가 사라진다
  const user = await prisma.user.create({
    data: { id: "check-invite-user", displayName: `${TAG} 김철수` },
  });
  await prisma.inviteCode.update({
    where: { id: mine[0].id },
    data: { usedByUserId: user.id },
  });
  ok(!(await revokeInviteCode(mine[0].id)).ok, "소진된 코드는 폐기가 거절된다");

  // 한 사람이 두 코드를 소진할 수 없다 (usedByUserId unique)
  await issueInviteCode(`${TAG} 두번째`);
  const second = (await listInviteCodes()).find((r) => r.label === `${TAG} 두번째`)!;
  let twice = false;
  try {
    await prisma.inviteCode.update({
      where: { id: second.id },
      data: { usedByUserId: user.id },
    });
  } catch {
    twice = true;
  }
  ok(twice, "한 사람이 두 코드를 소진하지 못한다");

  ok((await revokeInviteCode(second.id)).ok, "안 쓴 코드는 지워진다");
  ok(!(await revokeInviteCode("없는id")).ok, "없는 코드는 거절한다");

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
