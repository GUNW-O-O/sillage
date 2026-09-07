/// 로컬 개발에서 로그인 게이트를 끄는 스위치 (설계 10-1).
///
/// **기본값이 게이트 켜짐이다.** 변수가 없으면 폴백이 없다 — 반대로 두면 배포에서
/// 빼먹었을 때 무방비가 되고, **빼먹은 것이 조용하다.**
///
/// **production 에서는 스위치를 아예 안 본다.** 배포 환경에 `AUTH_DISABLED=1` 이 실수로
/// 들어가도 구멍이 안 뚫린다. 대가는 이 스위치로 프로덕션을 디버깅할 수 없다는 것이고,
/// 그게 의도다.
///
/// **의존성이 없는 자리에 둔다.** `proxy.ts`(edge)와 `identity.ts`(prisma 를 쓴다)가
/// 같은 판정을 봐야 하는데, identity 쪽에 두면 proxy 가 prisma 를 끌고 들어간다.
export function authBypassed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_DISABLED === "1";
}
