/// 로그인 게이트가 켜져 있어도 스펙 27건이 손대지 않고 도는 자리 (설계 10-6).
///
/// **`/join` 을 통과하지 않는다.** 설계 10-6 은 「코드를 하나 발급해 `/join` 을 한 번
/// 통과」였는데, 교환은 **새 계정**을 만든다 (`role = USER`, 새 cuid) — 그러면
/// `helpers.USER = "seed-admin"` 으로 심은 기록이 그 사람에게 안 보이고 어드민 화면은
/// 아예 못 들어간다. 「스펙을 손대지 않는다」가 목적이었으므로 시드 어드민의 쿠키를
/// 직접 굽는다. 교환 경로 자체는 `join.spec.ts` 가 브라우저에서 그대로 본다.
///
/// **DB 를 안 본다.** 게이트도 `verifySessionToken` 만 보므로(설계 10-2) 서명이면 충분하다.
///
/// 스위치(`AUTH_DISABLED=1`)가 켜져 있든 꺼져 있든 같은 쿠키가 붙는다 — 리허설이
/// 별도 모드가 아니라 `.env` 한 줄을 빼는 것으로 끝난다.

import { mkdirSync, writeFileSync } from "node:fs";
import "dotenv/config";

import { SESSION_COOKIE, SESSION_MAX_AGE_SEC, signSessionToken } from "../src/lib/auth/token";

/// `identity.ts` 의 `SEED_ADMIN_ID` · `helpers.ts` 의 `USER` 와 같은 값이다.
/// **import 하지 않고 적는다** — 그 두 모듈은 열자마자 PrismaClient 를 만들어,
/// 문자열 하나 때문에 전역 셋업이 DB 커넥션을 쥔다.
const SEED_ADMIN_ID = "seed-admin";

export const STATE_PATH = "e2e/.auth/state.json";

export default async function globalSetup() {
  const token = await signSessionToken(SEED_ADMIN_ID);
  mkdirSync("e2e/.auth", { recursive: true });
  writeFileSync(
    STATE_PATH,
    JSON.stringify({
      cookies: [
        {
          name: SESSION_COOKIE,
          value: token,
          domain: "localhost",
          path: "/",
          expires: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
          httpOnly: true,
          // 로컬은 http 다. 켜면 쿠키가 아예 안 붙는다 (`session.ts` 와 같은 이유)
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    }),
  );
}
