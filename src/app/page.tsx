import { AppShell } from "@/components/app-shell";
import { RecordList } from "@/components/record-list";
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
      noteHits: { select: { value: true } },
      product: {
        select: {
          id: true,
          name: true,
          vendor: { select: { name: true } },
          _count: { select: { sellerNotes: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows = records.map((r) => ({
    id: r.id,
    productId: r.product.id,
    productName: r.product.name,
    vendorName: r.product.vendor.name,
    noteCount: r.product._count.sellerNotes,
    // 느낀 것(HIT)이 몇 개였나. 목록에서 바로 보이는 것이 이 도구의 요점이다
    hitCount: r.noteHits.filter((h) => h.value === "WEAK" || h.value === "STRONG").length,
  }));

  return (
    <AppShell>
      <h1 className="pt-6 pb-2 font-serif text-[28px] leading-tight tracking-[-0.4px] text-ink">
        실라주
      </h1>

      {rows.length === 0 ? (
        <div className="py-10">
          <p className="text-[16px] text-body">아직 기록이 없다.</p>
          <p className="mt-2 text-[13px] text-muted">
            우측 아래 <span className="text-ink">+</span> 로 원두를 찾아 기록을 시작한다.
          </p>
        </div>
      ) : (
        <RecordList records={rows} />
      )}
    </AppShell>
  );
}
