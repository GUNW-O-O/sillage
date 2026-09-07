import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  signSessionToken,
  verifySessionToken,
} from "./token";

export async function issueSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSessionToken(userId), {
    httpOnly: true,
    // **로컬에서는 끈다.** 개발은 http 라 켜두면 쿠키가 아예 안 붙어
    // "로그인은 됐는데 다음 요청에서 로그아웃" 이 된다
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/// 쿠키에서 userId 를 읽는다. 없거나 못 믿으면 null.
///
/// **요청 바깥에서 부르면 `cookies()` 가 던진다.** `scripts/check-*.ts` 가 서버 액션을
/// 직접 import 해서 Node 에서 돌린다 — 거기에는 요청 컨텍스트가 없다. 그 경우는
/// "세션이 없다" 와 같으므로 null 로 받는다. 안 잡으면 DB 검사 전량이 죽는다.
///
/// **다만 프레임워크가 던진 것은 다시 던진다.** 정적 프리렌더 중의 `cookies()` 는
/// `DynamicServerError` 를 던져 "이 라우트는 동적이다" 를 알리는 신호다. 그것까지
/// 삼키면 "세션이 없다" 로 처리돼 `identity.ts` 의 폴백이 시드 어드민을 주고,
/// 그 사람의 데이터가 빌드 타임에 구워져 모든 방문자에게 나간다. 지금은 페이지 전부가
/// `force-dynamic` 이라 안 터지지만, 그 한 줄이 빠지면 조용히 새는 자리다.
export async function readSession(): Promise<string | null> {
  let token: string | undefined;
  try {
    token = (await cookies()).get(SESSION_COOKIE)?.value;
  } catch (e) {
    unstable_rethrow(e);
    return null;
  }
  return token ? verifySessionToken(token) : null;
}
