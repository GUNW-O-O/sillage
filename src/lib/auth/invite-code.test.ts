import { expect, it } from "vitest";

import { generateInviteCode, INVITE_TTL_MS } from "./invite-code";

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
