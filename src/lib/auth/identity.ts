import { cache } from "react";

import { prisma } from "../db";
import { authBypassed } from "./bypass";
import { readSession } from "./session";

export type SessionUser = { id: string; displayName: string; role: "USER" | "ADMIN" };

/// 로그인 게이트를 끈 로컬 개발에서 누가 되는가 (설계 10-1).
///
/// 1차에는 이 폴백이 **무조건** 걸렸고 2차에서 지울 예정이었다. 지우는 대신
/// `authBypassed()` 뒤로 옮겼다 — 그 한 줄 덕에 `scripts/check-*.ts` 7개와 e2e 24건이
/// 세션 없이도 지금 모습 그대로 돈다. 배포에서는 스위치를 안 보므로 폴백이 없다.
export const SEED_ADMIN_ID = "seed-admin";

/// **요청 하나 안에서는 한 번만 조회한다.** `await` 이 붙으면서 공짜 상수였던 것이
/// 매번 DB 왕복이 됐다 — 어드민 액션 하나가 가드하고 안에서 다른 액션을 부르면 그것도
/// 또 가드하므로 한 클릭에 세 번까지 나갔고, `/admin/accounts` 는 한 렌더에 네 번이었다.
/// 요청 안에서 신원이 바뀌지 않으므로 캐시가 틀릴 자리가 없다.
///
/// `cache()` 는 React 요청 밖(= `scripts/check-*.ts` 의 Node 실행)에서는 그냥 캐시가
/// 안 걸릴 뿐 던지지 않는다. 그쪽 동작은 그대로다.
export const currentUser = cache(async function currentUser(): Promise<SessionUser | null> {
  // **분기가 여기 한 곳뿐이다.** 로그인 게이트도 어드민 가드 34개도 전부 이 함수 위에
  // 서므로, 스위치를 여기서만 보면 호출부 · 검사 스크립트 · e2e 가 손댈 것이 없다 (설계 10-1)
  const userId = (await readSession()) ?? (authBypassed() ? SEED_ADMIN_ID : null);
  if (!userId) return null;
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
