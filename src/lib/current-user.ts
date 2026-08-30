/// 임시 — 인증은 배포 시점 요구다 (요구 FR-10).
/// 로컬 개발 구간에는 로그인 화면이 없고, 시드가 만든 계정 하나로 돈다.
/// 세션이 붙으면 이 함수만 갈아끼운다. 호출부는 안 바뀐다.
export const SEED_ADMIN_ID = "seed-admin";

export function currentUserId(): string {
  return SEED_ADMIN_ID;
}
