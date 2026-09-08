import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

/// dev 레인 — 같은 스펙 전량을 `next dev` 에 돌린다. `npm run e2e:dev`.
///
/// **StrictMode 를 보는 유일한 자리다.** effect 가 `실행 → 정리 → 재실행` 으로 두 번 도는
/// 것은 dev 에만 있고, 실제로 그 자리에서 버그가 났다 (`src/lib/selection-resolver.ts`).
/// 기본 레인이 프로덕션 빌드라 그 성질이 사라졌으므로 여기를 남긴다.
///
/// **`npm run e2e:dev` 가 `.next/dev` 를 먼저 지운다.** 그 캐시가 상하면 실행이 2배로
/// 느려지고 목록을 안 거치는 딥링크만 404 가 나는데, **재현이 결정적이지 않아** 원인을
/// 찾는 데 오래 걸린다 (2026-09-08 에 한 번 겪었다. 스펙도 앱도 멀쩡했다).
/// 지우고 시작해도 통과 실행 시간이 그대로라(1.6분) 비용이 없다 — 그래서 늘 지운다.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // 개발 중 띄워 둔 것을 그대로 쓴다. dev 서버는 기동이 느리다
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
