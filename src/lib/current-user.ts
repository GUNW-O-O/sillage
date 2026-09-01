/// 임시 — 인증은 배포 시점 요구다 (요구 FR-10).
/// 로컬 개발 구간에는 로그인 화면이 없고, 시드가 만든 계정 하나로 돈다.
/// 세션이 붙으면 이 함수만 갈아끼운다. 호출부는 안 바뀐다.
export const SEED_ADMIN_ID = "seed-admin";

export function currentUserId(): string {
  return SEED_ADMIN_ID;
}

/// 어드민만 할 수 있는 조작인가.
///
/// **화면을 감추는 것으로는 부족하다.** 서버 액션은 경로만 알면 요청이 들어오는
/// 공개 엔드포인트라, 버튼을 안 그려도 액션 자체가 열려 있으면 막힌 게 아니다.
///
/// 지금은 로그인이 없어(요구 FR-10) 시드 계정 하나가 ADMIN 이므로 실질적으로 통과한다.
/// 세션이 붙으면 `currentUserId` 만 갈아끼우면 이 함수와 호출부는 안 바뀐다.
/// **어드민 레이아웃과 나머지 어드민 액션 전량에 같은 확인이 필요하다** — 2차 배포 몫이다.
export async function requireAdmin(): Promise<void> {
  const { prisma } = await import("./db");
  const user = await prisma.user.findUnique({
    where: { id: currentUserId() },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") throw new Error("어드민만 할 수 있다");
}
