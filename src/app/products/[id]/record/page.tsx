import { notFound } from "next/navigation";

import { NoteCycle } from "@/components/note-cycle";
import { currentUserId } from "@/lib/current-user";
import { prisma } from "@/lib/db";

// FR-5 · FR-6 — 4상태 순환 대조와 저장.
//
// Product 당 Experience 는 1개이므로(설계 4-4) 원두 id 가 곧 그 기록의 주소다.
// 신규와 편집을 라우트로 나누지 않는다.
export const dynamic = "force-dynamic";

export default async function RecordPage({ params }: PageProps<"/products/[id]/record"> ) {
  const { id } = await params;
  const userId = currentUserId();

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      vendor: { select: { name: true } },
      sellerNotes: {
        select: { id: true, raw: true, nodeId: true },
        orderBy: { position: "asc" },
      },
      experiences: {
        where: { userId },
        select: { id: true, noteHits: { select: { sellerNoteId: true, value: true } } },
        take: 1,
      },
    },
  });
  if (!product) notFound();

  const experience = product.experiences[0];
  const initial = Object.fromEntries(
    (experience?.noteHits ?? []).map((h) => [h.sellerNoteId, h.value]),
  );

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-6">
      <div className="text-[13px] text-muted">{product.vendor.name}</div>
      <h1 className="mt-0.5 text-[19px] font-semibold text-ink">{product.name}</h1>

      <div className="mt-4">
        <NoteCycle
          productId={product.id}
          notes={product.sellerNotes}
          initial={initial}
          hasRecord={!!experience}
        />
      </div>
    </main>
  );
}
