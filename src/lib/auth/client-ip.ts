import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";

/// 시도 제한이 세는 단위 (설계 10-4).
///
/// **서버 액션에는 `NextRequest` 가 없다.** `next/headers` 가 유일한 길이다.
///
/// 순서가 중요하다 — 프록시가 앞에 있으면 클라이언트가 보낸 `x-forwarded-for` 에
/// 아무 값이나 들어 있을 수 있다. Cloudflare 의 `cf-connecting-ip` 는 엣지가 직접 쓰고,
/// Vercel 은 프록시 뒤에서도 `x-forwarded-for` 를 **자기가 덮어써** 위조를 막는다.
/// 셀프 호스팅이면 앞단 프록시가 그 헤더를 정리해 준다는 전제가 필요하다.
///
/// **요청 바깥에서 부르면 `headers()` 가 던진다.** `scripts/check-*.ts` 가 교환 액션을
/// 직접 import 해서 Node 에서 돌리는데 거기에는 요청 컨텍스트가 없다 — 세션과 같은 사정이라
/// 같은 모양으로 받는다 (`session.ts` 의 `readSession`). 프레임워크가 던진 것은 다시 던진다.
export async function clientIp(): Promise<string> {
  let h: Awaited<ReturnType<typeof headers>>;
  try {
    h = await headers();
  } catch (e) {
    unstable_rethrow(e);
    return "unknown";
  }

  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  // 여러 프록시를 지나면 쉼표로 이어진다. 맨 앞이 원 클라이언트다
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const real = h.get("x-real-ip")?.trim();
  if (real) return real;

  // **못 얻어도 세는 것을 포기하지 않는다.** 한 바구니에 담겨 서로 잠글 수 있지만,
  // 헤더가 없는 환경은 사실상 로컬뿐이라 그 바구니에 사람이 하나다
  return "unknown";
}
