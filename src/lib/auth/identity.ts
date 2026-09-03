import { cache } from "react";

import { prisma } from "../db";
import { readSession } from "./session";

export type SessionUser = { id: string; displayName: string; role: "USER" | "ADMIN" };

/// **1차 한정 폴백의 대상.** 로그인 화면이 아직 없다 (요구 FR-10 · 설계 3-4).
/// 2차에서 이 상수와 아래 `?? SEED_ADMIN_ID` 를 함께 지운다.
export const SEED_ADMIN_ID = "seed-admin";

/// **요청 하나 안에서는 한 번만 조회한다.** `await` 이 붙으면서 공짜 상수였던 것이
/// 매번 DB 왕복이 됐다 — 어드민 액션 하나가 가드하고 안에서 다른 액션을 부르면 그것도
/// 또 가드하므로 한 클릭에 세 번까지 나갔고, `/admin/accounts` 는 한 렌더에 네 번이었다.
/// 요청 안에서 신원이 바뀌지 않으므로 캐시가 틀릴 자리가 없다.
///
/// `cache()` 는 React 요청 밖(= `scripts/check-*.ts` 의 Node 실행)에서는 그냥 캐시가
/// 안 걸릴 뿐 던지지 않는다. 그쪽 동작은 그대로다.
export const currentUser = cache(async function currentUser(): Promise<SessionUser | null> {
  // 2차에서 `?? SEED_ADMIN_ID` 만 지우면 이 함수는 그대로 쓴다
  const userId = (await readSession()) ?? SEED_ADMIN_ID;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, role: true },
  });
});

/// **async 다.** `cookies()` 가 async 라 피할 수 없다 — 호출부 20곳에 `await` 이 붙는다.
/// 로직은 안 바뀌고 시그니처만 바뀐다 (설계 3-4).
export async function currentUserId(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error("로그인이 필요하다");
  return user.id;
}
