import { currentUser, type SessionUser } from "./identity";

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("로그인이 필요하다");
  return user;
}

/// 어드민만 할 수 있는 조작인가.
///
/// **화면을 감추는 것으로는 부족하다.** 서버 액션은 경로만 알면 요청이 들어오는
/// 공개 엔드포인트라, 버튼을 안 그려도 액션 자체가 열려 있으면 막힌 게 아니다 (설계 4-1).
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("어드민만 할 수 있다");
  return user;
}
