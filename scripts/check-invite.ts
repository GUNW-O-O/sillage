// 초대 코드 — DB 에 걸린 것만 본다. unique · 만료 · 1회용 · 소진 보호.
// **제약은 DB 로만 확인된다.** 액션이 먼저 막아도 그것은 애플리케이션의 예의지 제약이 아니다.
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

  await cleanup();
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
