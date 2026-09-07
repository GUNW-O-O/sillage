// 초대 코드 — 세 갈래를 본다 (16건).
//
// **DB 제약 자체** (2건): 액션을 거치지 않고 raw prisma 로 직접 찌른다 —
// 같은 code 중복 생성, 같은 usedByUserId 로 두 번 소진. 스키마에서 그 `@unique` 를
// 지우면 이 둘만 FAIL 로 뒤집힌다.
//
// **액션의 거절** (9건): issueInviteCode · revokeInviteCode 안의 `if` 문이
// 실제로 막는지 보는 통합 검사다. label 에는 CHECK 제약이 없고, 소진된 InviteCode 를
// 지워도 FK 위반이 나지 않는다(참조가 User 쪽으로만 나간다) — 이 아홉은 액션의 JS 가드를
// 지우면 FAIL 로 뒤집히지만 DB 제약과는 무관하다. 그래도 지울 가치는 없다: 이 액션들이
// 실제로 거절하는지를 보는 유일한 자리다.
//
// **교환의 거절과 시도 제한** (5건, `checkRedeem`): 여기가 DB 층이어야 하는 이유는
// 시도 행이 실제로 쌓이고 창이 지나면 풀리는지를 보기 때문이다. 순수 함수 층은 규칙만
// 보고(`isLockedOut`), 브라우저 층은 성공 경로를 본다. **성공 경로는 여기서 못 본다** —
// 쿠키를 구우려면 요청 컨텍스트가 필요하다.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import {
  issueInviteCode,
  listInviteCodes,
  redeemInviteCode,
  revokeInviteCode,
} from "../src/app/actions";
import {
  ATTEMPT_LIMIT,
  ATTEMPT_WINDOW_MS,
  INVITE_TTL_MS,
} from "../src/lib/auth/invite-code";

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

  await checkRedeem(mine[0].code, second.code);

  if (failed > 0) {
    console.error(`\n${failed}건 실패`);
    process.exitCode = 1;
  }
}

/// DB 에 실제로 없는 6자리 코드 하나. 100만 가지 중 발급된 것은 손에 꼽으므로 금방 잡힌다
async function findAbsentCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!(await prisma.inviteCode.findUnique({ where: { code }, select: { id: true } }))) {
      return code;
    }
  }
  throw new Error("빈 코드를 못 찾았다 — InviteCode 가 비정상적으로 많다");
}

/// 교환의 **거절 경로와 시도 제한** (설계 10-3 · 10-4).
///
/// **성공 경로는 여기서 원리적으로 못 본다.** 성공하면 `issueSession` 이 `cookies()` 를
/// 부르는데 Node 에는 요청 컨텍스트가 없다 — 그쪽은 e2e 가 본다. 거절은 쿠키를 안 굽는다.
///
/// `clientIp()` 도 같은 이유로 여기서는 "unknown" 을 낸다. 시도 행이 그 한 바구니에
/// 담기므로 **블록 앞뒤로 비운다** — 안 비우면 앞의 실패가 뒤의 잠금 판정에 섞인다.
async function checkRedeem(usedCode: string, freeCode: string) {
  const IP = "unknown";
  const clearAttempts = () => prisma.inviteAttempt.deleteMany({ where: { ip: IP } });
  const reject = async (code: string) => {
    const r = await redeemInviteCode(code);
    return r.ok ? "성공했다" : r.message;
  };

  // 만료된 코드. 방금 폐기해 비어 있는 code 를 재사용하고 `expiresAt` 만 과거로 둔다
  const stale = await prisma.inviteCode.create({
    data: {
      code: freeCode,
      label: `${TAG} 만료`,
      createdById: "seed-admin",
      expiresAt: new Date(Date.now() - 1000),
    },
  });

  await clearAttempts();

  // **거절 사유를 구분해 주지 않는다** (설계 10-3). 구분해 주면 자동 대입하는 쪽에
  // "이 코드는 존재한다" 를 알려주게 된다 — 네 갈래가 전부 같은 문구여야 한다.
  // **없는 코드를 아무거나 고르면 안 된다.** 개발 DB 에 살아 있는 코드를 집으면 교환이
  // 정말 성공해서 계정이 하나 생기고, 그때만 이 검사가 흔들린다. DB 에 없는 것을 확인해 쓴다
  const missingCode = await findAbsentCode();

  const short = await reject("12345");
  const used = await reject(usedCode);
  const expired = await reject(stale.code);
  const missing = await reject(missingCode);

  const messages = new Set([short, used, expired, missing]);
  ok(messages.size === 1 && !messages.has("성공했다"), "형식 · 소진 · 만료 · 없음이 같은 문구로 거절된다");
  const REJECTED = short;

  ok(
    (await prisma.inviteAttempt.count({ where: { ip: IP } })) === 4,
    "실패 한 건이 시도 행 한 개로 남는다",
  );

  // 시도 제한. 위 4건을 지우고 임계값을 정확히 채운다
  await clearAttempts();
  for (let i = 0; i < ATTEMPT_LIMIT; i++) await reject("12345");
  ok((await reject("12345")) !== REJECTED, "임계값을 넘으면 잠긴다");
  ok(
    (await prisma.inviteAttempt.count({ where: { ip: IP } })) === ATTEMPT_LIMIT,
    "잠긴 뒤의 시도는 행을 더 안 남긴다",
  );

  // **창을 안 자르면 잠금이 영구가 된다.** 시각을 뒤로 밀어 창을 지나간 것으로 만든다
  await prisma.inviteAttempt.updateMany({
    where: { ip: IP },
    data: { at: new Date(Date.now() - ATTEMPT_WINDOW_MS - 60_000) },
  });
  ok((await reject("12345")) === REJECTED, "창이 지나면 잠금이 풀린다");

  await clearAttempts();
  await prisma.inviteCode.delete({ where: { id: stale.id } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
