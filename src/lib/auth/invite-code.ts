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
