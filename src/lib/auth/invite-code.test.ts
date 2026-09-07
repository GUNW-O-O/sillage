import { describe, expect, it } from "vitest";

import {
  ATTEMPT_LIMIT,
  ATTEMPT_WINDOW_MS,
  generateInviteCode,
  INVITE_TTL_MS,
  isLockedOut,
} from "./invite-code";

it("항상 6자리 숫자다", () => {
  // 앞자리 0 이 잘리면 5자리가 나온다. 100번이면 0 으로 시작하는 코드가 거의 확실히 나온다
  for (let i = 0; i < 100; i++) {
    expect(generateInviteCode()).toMatch(/^[0-9]{6}$/);
  }
});

it("같은 값만 내놓지 않는다", () => {
  const seen = new Set(Array.from({ length: 50 }, generateInviteCode));
  expect(seen.size).toBeGreaterThan(1);
});

it("만료가 24시간이다", () => {
  expect(INVITE_TTL_MS).toBe(24 * 60 * 60 * 1000);
});

// 시도 제한 (설계 10-4). **잠금 판정은 순수 함수라 여기가 맞는 자리다** —
// DB 검사는 "행이 쌓이면 거절하나" 를 보고, 경계와 창 자르기는 여기서 본다.
describe("isLockedOut", () => {
  const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);
  const agoMs = (ms: number) => new Date(NOW - ms);
  const times = (n: number, ms: number) => Array.from({ length: n }, () => agoMs(ms));

  it("한 번도 안 틀렸으면 안 잠긴다", () => {
    expect(isLockedOut([], NOW)).toBe(false);
  });

  it("임계값 직전까지는 안 잠긴다", () => {
    expect(isLockedOut(times(ATTEMPT_LIMIT - 1, 1000), NOW)).toBe(false);
  });

  it("임계값에 닿으면 잠긴다", () => {
    expect(isLockedOut(times(ATTEMPT_LIMIT, 1000), NOW)).toBe(true);
  });

  // **이걸 안 보면 잠금이 영구가 된다.** 창을 안 자르면 어제 틀린 열 번이 오늘도 센다
  it("창 밖의 실패는 안 센다", () => {
    expect(isLockedOut(times(ATTEMPT_LIMIT, ATTEMPT_WINDOW_MS + 1000), NOW)).toBe(false);
  });

  it("창 경계에 정확히 걸친 실패는 창 밖이다", () => {
    expect(isLockedOut(times(ATTEMPT_LIMIT, ATTEMPT_WINDOW_MS), NOW)).toBe(false);
  });

  it("창 안과 밖이 섞이면 안쪽만 센다", () => {
    const mixed = [...times(ATTEMPT_LIMIT - 1, 1000), ...times(5, ATTEMPT_WINDOW_MS + 1000)];
    expect(isLockedOut(mixed, NOW)).toBe(false);
  });
});
