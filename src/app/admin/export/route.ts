import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { buildExport, exportFileName } from "@/lib/export";

/// 전량 내보내기 (요구 FR-8). **파괴적 마이그레이션 직전의 백업이 근거다.**
///
/// 서버 액션이 아니라 라우트 핸들러다 — 브라우저가 파일로 받아야 하고,
/// 그건 응답 헤더로만 된다. 화면 쪽은 `<a href>` 한 줄이라 클라이언트 상태가 없다.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    // **403 도 500 도 "여기 어드민이 있다" 를 알려준다** (설계 4-2).
    // `/admin` 레이아웃이 `notFound()` 를 내는 것과 같은 이유로 404 를 낸다.
    // 라우트 핸들러라 `notFound()` 대신 응답을 직접 만든다
    return new Response(null, { status: 404 });
  }

  const payload = await buildExport(prisma);

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // attachment 가 없으면 브라우저가 그냥 화면에 펼친다
      "content-disposition": `attachment; filename="${exportFileName()}"`,
      // 백업은 늘 지금 것이어야 한다
      "cache-control": "no-store",
    },
  });
}
