import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";

/// 90일 (요구 FR-10). **쿠키 maxAge 와 같은 값을 쓴다** — 어긋나면 쿠키는 살아 있는데
/// 검증만 실패하는, 로그인도 로그아웃도 아닌 상태가 생긴다.
export const SESSION_MAX_AGE_SEC = 90 * 24 * 60 * 60;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET 이 없거나 32자 미만이다");
  return new TextEncoder().encode(s);
}

/// payload 는 `sub`(=userId) · `iat` · `exp` 뿐이다. **provider 를 넣지 않는다** (설계 3-3) —
/// 넣으면 OAuth 를 붙이는 순간 이미 발급된 90일짜리 쿠키 전량이 포맷 불일치로 죽는다.
export async function signSessionToken(userId: string, nowMs = Date.now()): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_SEC)
    .sign(secret());
}

/// 못 믿을 토큰은 전부 null 이다 — 변조 · 만료 · 다른 키 · 쓰레기 문자열을 구분하지 않는다.
/// 호출부가 구분할 이유가 없고, 구분해서 알려주면 공격자에게 정보를 준다.
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
