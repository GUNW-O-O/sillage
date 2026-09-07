import { randomInt } from "node:crypto";

/// 24시간 (요구 FR-10)
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/// 6자리 숫자. **앞자리 0 을 살린다** — "012345" 도 유효한 코드다. padStart 가 없으면
/// 100만 가지 중 10만 가지를 못 뽑고, 어드민이 읽어준 코드와 저장된 값이 어긋난다.
///
/// `Math.random` 을 쓰지 않는다. 평문 저장이라(설계 5-2) 코드가 예측 가능해지면
/// 만료가 유일한 방어인 자리에서 그마저 사라진다.
export function generateInviteCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/// 시도 제한 (설계 10-4). 코드를 평문으로 저장하므로 해시의 보호가 없다 —
/// **만료와 이 둘이 유일한 방어다.**
///
/// 사람이 손으로 치다 틀리는 횟수는 10 근처에 안 온다. 100만 가지를 이 속도로 훑으면 28년이다.
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const ATTEMPT_LIMIT = 10;

/// 이 IP 가 잠겼는가. **창 자르기와 경계를 한 함수가 쥔다** — 호출부가 창을 따로 계산하면
/// 규칙이 두 곳이 되고, 어느 쪽이 진짜인지 테스트가 못 정한다.
///
/// `failedAt` 은 최근 실패 시각들(최신순 `ATTEMPT_LIMIT` 개면 충분하다).
export function isLockedOut(failedAt: Date[], now = Date.now()): boolean {
  const since = now - ATTEMPT_WINDOW_MS;
  return failedAt.filter((t) => t.getTime() > since).length >= ATTEMPT_LIMIT;
}
