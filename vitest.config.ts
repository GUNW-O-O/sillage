import { defineConfig } from "vitest/config";

// vitest 는 순수 함수만 본다. e2e/ 는 Playwright 가 돌리므로 여기서 제외한다 —
// 안 빼면 `npm test` 가 Playwright 스펙을 집어 실패한다.
//
// 검증이 세 층으로 갈린다:
//   vitest          순수 함수 (noteSetHash · normalizeName · 순차 노출 · 이름 해석)
//   scripts/check-* DB 에 걸린 것 (제약 · 소급 규칙 · 인덱스와 실행계획)
//   playwright      브라우저에서만 드러나는 것 (클라이언트 상태 · effect 수명주기)
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
