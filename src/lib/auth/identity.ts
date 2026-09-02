import { prisma } from "../db";
import { readSession } from "./session";

export type SessionUser = { id: string; displayName: string; role: "USER" | "ADMIN" };

/// **1차 한정 폴백의 대상.** 로그인 화면이 아직 없다 (요구 FR-10 · 설계 3-4).
/// 2차에서 이 상수와 아래 `?? SEED_ADMIN_ID` 를 함께 지운다.
export const SEED_ADMIN_ID = "seed-admin";

export async function currentUser(): Promise<SessionUser | null> {
  // 2차에서 `?? SEED_ADMIN_ID` 만 지우면 이 함수는 그대로 쓴다
  const userId = (await readSession()) ?? SEED_ADMIN_ID;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, role: true },
  });
}

/// **async 다.** `cookies()` 가 async 라 피할 수 없다 — 호출부 20곳에 `await` 이 붙는다.
/// 로직은 안 바뀌고 시그니처만 바뀐다 (설계 3-4).
export async function currentUserId(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error("로그인이 필요하다");
  return user.id;
}
