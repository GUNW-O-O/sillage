import { AppShell } from "@/components/app-shell";
import { currentUserId } from "@/lib/current-user";
import { prisma } from "@/lib/db";

// 개인 데이터라 SEO 대상이 아니다. 서버에서 읽고 넘긴다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = currentUserId();

  const records = await prisma.experience.findMany({
    where: { userId },
    select: {
      id: true,
      product: {
        select: {
          name: true,
          vendor: { select: { name: true } },
          _count: { select: { sellerNotes: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell>
      {records.length === 0 ? (
        <div className="py-16">
          <p className="text-[16px] text-body">아직 기록이 없다.</p>
          <p className="mt-2 text-[13px] text-muted">
            우측 상단 <span className="text-ink">+</span> 로 원두를 찾아 기록을 시작한다.
          </p>
        </div>
      ) : (
        <ul className="py-2">
          {records.map((r) => (
            <li key={r.id}>
              <a
                href={`/records/${r.id}`}
                className="flex min-h-14 flex-col justify-center border-b border-hairline-soft py-3"
              >
                <span className="text-[17px] font-semibold text-ink">{r.product.name}</span>
                <span className="mt-0.5 text-[13px] text-muted">
                  {r.product.vendor.name} · 노트 {r.product._count.sellerNotes}개
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
