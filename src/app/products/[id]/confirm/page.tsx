import Link from "next/link";
import { notFound } from "next/navigation";

import { currentUserId } from "@/lib/auth/identity";
import { prisma } from "@/lib/db";

// FR-4 — "이것으로 기록을 입력할까요?"
// 등록과 기록은 끊기지 않는다. 확인 한 번을 거쳐 대조 화면으로 간다 (설계 7-1).
export const dynamic = "force-dynamic";

export default async function ConfirmPage({ params }: PageProps<"/products/[id]/confirm">) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      vendor: { select: { name: true } },
      sellerNotes: { select: { raw: true, nodeId: true }, orderBy: { position: "asc" } },
      experiences: { where: { userId: await currentUserId() }, select: { id: true }, take: 1 },
    },
  });
  if (!product) notFound();

  const hasRecord = product.experiences.length > 0;

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-6">
      <h1 className="font-serif text-[22px] text-ink">
        {hasRecord ? "이 원두를 다시 볼까요?" : "이 원두로 기록할까요?"}
      </h1>

      <div className="mt-4 rounded-[10px] bg-surface-card p-4">
        <div className="text-[13px] text-muted">{product.vendor.name}</div>
        <div className="mt-0.5 text-[19px] font-semibold text-ink">{product.name}</div>

        <ul className="mt-3 flex flex-wrap gap-2">
          {product.sellerNotes.map((n) => (
            <li
              key={n.raw}
              className={`inline-flex min-h-9 items-center rounded-full px-3 text-[14px] ${
                n.nodeId ? "bg-canvas text-body" : "border border-dashed border-pending text-body"
              }`}
            >
              {n.raw}
            </li>
          ))}
        </ul>
      </div>

      {hasRecord && (
        <p className="mt-3 text-[13px] text-muted">
          이미 기록이 있어요. 새로 만들지 않고 그 기록을 고쳐요.
        </p>
      )}

      <Link
        href={`/products/${product.id}/record`}
        className="mt-6 flex h-12 w-full items-center justify-center rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed"
      >
        {hasRecord ? "기록 고치기" : "기록 입력"}
      </Link>
      <Link
        href="/"
        className="mt-2 flex h-12 w-full items-center justify-center rounded-[10px] border border-hairline text-[16px] text-ink"
      >
        나중에
      </Link>
    </main>
  );
}
