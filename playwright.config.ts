import { defineConfig, devices } from "@playwright/test";

// 브라우저에서만 드러나는 것을 잡는다 — 클라이언트 상태와 effect 수명주기.
// vitest 는 순수 함수만 보고 scripts/check-*.ts 는 DB 만 본다. 그 사이가 비어 있었다.
//
// **StrictMode 를 끄지 않는다.** 이 자리의 버그가 StrictMode 의 이중 실행에서 났다 —
// 끄면 개발에서 나는 것을 테스트가 못 본다. dev 서버를 그대로 쓴다.
export default defineConfig({
  testDir: "./e2e",
  // 전역 셋업이 시드 어드민의 세션 쿠키를 구워둔다 (설계 10-6).
  // **스위치가 켜져 있어도 쿠키를 붙인다** — 리허설이 별도 모드가 아니라
  // `.env` 에서 `AUTH_DISABLED=1` 을 빼는 것만으로 끝나야 한다.
  globalSetup: "./e2e/session-setup.ts",
  use: {
    ...devices["Pixel 7"], // 폰 우선 앱이다 (DESIGN)
    baseURL: "http://localhost:3000",
    storageState: "e2e/.auth/state.json",
  },
  // 이미 떠 있으면 그것을 쓴다. dev 서버는 기동이 느려 매번 새로 띄우지 않는다
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  // 기록은 Product 당 1개라 병렬로 같은 원두를 건드리면 서로를 덮는다
  workers: 1,
  reporter: [["list"]],
});
