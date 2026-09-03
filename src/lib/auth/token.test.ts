import { beforeEach, expect, it } from "vitest";

import { SESSION_MAX_AGE_SEC, signSessionToken, verifySessionToken } from "./token";

// 검증이 세 층이다. 서명·검증은 순수 함수라 여기가 맞는 자리다 —
// 쿠키 IO 를 섞으면 이 층에서 못 본다 (그래서 token.ts 가 next/headers 를 안 쓴다)
beforeEach(() => {
  process.env.AUTH_SECRET = "a".repeat(64);
});

it("서명한 토큰에서 userId 가 그대로 나온다", async () => {
  const token = await signSessionToken("user-1");
  expect(await verifySessionToken(token)).toBe("user-1");
});

it("변조된 토큰은 거절한다", async () => {
  const token = await signSessionToken("user-1");
  expect(await verifySessionToken(token.slice(0, -2) + "xx")).toBeNull();
});

it("만료된 토큰은 거절한다", async () => {
  const past = Date.now() - (SESSION_MAX_AGE_SEC + 60) * 1000;
  const token = await signSessionToken("user-1", past);
  expect(await verifySessionToken(token)).toBeNull();
});

it("다른 비밀키로 서명된 토큰은 거절한다", async () => {
  const token = await signSessionToken("user-1");
  process.env.AUTH_SECRET = "b".repeat(64);
  expect(await verifySessionToken(token)).toBeNull();
});

it("비밀키가 없으면 서명 자체가 실패한다", async () => {
  delete process.env.AUTH_SECRET;
  await expect(signSessionToken("user-1")).rejects.toThrow();
});

// 검증도 시끄럽게 죽어야 한다. null 로 삼키면 설정 실수가 "전원 로그아웃" 과
// 구별되지 않는다 — 멀쩡한 토큰인데 키가 없는 것이 여기서 잡힌다
it("비밀키가 없으면 검증이 null 이 아니라 예외를 낸다", async () => {
  const token = await signSessionToken("user-1");
  delete process.env.AUTH_SECRET;
  await expect(verifySessionToken(token)).rejects.toThrow();
});
