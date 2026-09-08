import { defineConfig, devices } from "@playwright/test";

/// 브라우저에서만 드러나는 것을 잡는다 — 클라이언트 상태와 effect 수명주기.
/// vitest 는 순수 함수만 보고 scripts/check-*.ts 는 DB 만 본다. 그 사이가 비어 있었다.
///
/// **프로덕션 빌드를 상대한다** (2026-09-08). 예전에는 dev 서버였는데 흔들림의 원인이
/// 거기였다 — `.next/dev` 가 실행 사이에 살아남는 361MB 짜리 가변 캐시고, 스키마 ·
/// 서버 액션 · `.env` 를 고칠 때마다 강제 종료가 필요한데(Windows 는 `pkill` 이 안 먹는다)
/// **컴파일 도중에 죽이면 그 캐시가 상한다.** 상한 뒤에는 실행이 2배로 느려지고
/// 목록을 안 거치는 딥링크가 404 를 냈다. 같은 스펙 29건을 재보면 22~31초 대 1.3~1.6분이고,
/// 상한 상태에서는 3분에 6건이 떨어졌다. 앱은 그 셋 어디서도 안 바뀌었다.
///
/// **대가는 StrictMode 다.** 이중 실행은 dev 에만 있고 실제로 그 자리에서 버그가 났다
/// (`src/lib/selection-resolver.ts`). 그래서 dev 레인을 버리지 않고 남긴다 —
/// `npm run e2e:dev` 가 같은 스펙 전량을 dev 서버에 돌린다 (`playwright.dev.config.ts`).
export const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  // 전역 셋업이 시드 어드민의 세션 쿠키를 구워둔다 (설계 10-6).
  // **프로덕션에서는 이것 없이 아무것도 안 돈다** — `authBypassed()` 가 `NODE_ENV` 를
  // 먼저 보므로 `identity.ts` 의 시드 어드민 폴백이 아예 존재하지 않는다.
  globalSetup: "./e2e/session-setup.ts",
  use: {
    ...devices["Pixel 7"], // 폰 우선 앱이다 (DESIGN)
    baseURL: `http://localhost:${PORT}`,
    storageState: "e2e/.auth/state.json",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // **떠 있는 것을 갖다 쓰지 않는다.** 3000 의 dev 서버를 물면 이 레인의 의미가
    // 통째로 사라지는데, 그게 조용하다. 포트를 3000 에서 떼어 놓은 이유도 같다 —
    // 개발 중에도 이 레인이 그대로 돈다
    reuseExistingServer: false,
    timeout: 180_000,
  },
  // 기록은 Product 당 1개라 병렬로 같은 원두를 건드리면 서로를 덮는다
  workers: 1,
  reporter: [["list"]],
});
