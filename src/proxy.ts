import { NextResponse, type NextRequest } from "next/server";

import { authBypassed } from "@/lib/auth/bypass";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

/// 로그인 게이트 (설계 10-2).
///
/// **파일 이름이 `proxy.ts` 다.** Next 16 에서 `middleware` 규약이 이 이름으로 바뀌었다 —
/// 앱 앞에 놓인 네트워크 경계라는 뜻이고, 하는 일은 같다.
///
/// **이것은 인가가 아니라 안내다.** 진짜 방어는 서버 액션 첫 줄의 가드 34개다
/// (설계 4-1 · 4-3) — 미들웨어가 뚫려도 액션은 여전히 거절한다.
/// 그래서 여기에 role 판정을 넣지 않는다. 넣으면 판정이 두 곳이 되고 어긋날 자리가 생긴다.
///
/// **DB 를 안 본다.** 서명과 만료만 확인한다. 요청마다 DB 를 왕복하면 그 비용이
/// 전 페이지에 붙는데, 여기서 얻는 것은 "로그인 화면으로 보낼까" 하나뿐이다.
///
/// `AUTH_SECRET` 이 없으면 `verifySessionToken` 이 던져 500 이 된다. **그게 맞다** —
/// 설정 실수가 "전원 로그아웃" 과 구별되지 않는 것이 더 나쁘다 (`token.ts`).
export async function proxy(req: NextRequest) {
  if (authBypassed()) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySessionToken(token))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/join";
  // 어디로 가려다 막혔는지는 안 남긴다. 되돌려 보낼 화면이 목록 하나뿐이라
  // 파라미터를 붙여봐야 쓸 데가 없고, 열린 리다이렉트를 검사할 자리만 는다
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // `/join` 을 빼지 않으면 교환 화면 자신이 자기에게 리다이렉트된다.
  // 확장자가 있는 경로(`.*\..*`)는 정적 파일이라 통째로 뺀다 — 폰트 · 아이콘이 여기 걸린다.
  matcher: ["/((?!join|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
