import Link from "next/link";
import { notFound } from "next/navigation";

import { NoteCycle } from "@/components/note-cycle";
import { currentUserId } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { collectLookupIds, describeProduct } from "@/lib/product-display";

// FR-5 · FR-6 — 4상태 순환 대조와 저장.
//
// Product 당 Experience 는 1개이므로(설계 4-4) 원두 id 가 곧 그 기록의 주소다.
// 신규와 편집을 라우트로 나누지 않는다.
export const dynamic = "force-dynamic";

const fmt = (d: Date) =>
  `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;

export default async function RecordPage({ params }: PageProps<"/products/[id]/record">) {
  const { id } = await params;
  const userId = currentUserId();

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      attributes: true,
      vendor: { select: { name: true } },
      sellerNotes: {
        select: { id: true, raw: true, nodeId: true },
        orderBy: { position: "asc" },
      },
      experiences: {
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          noteHits: { select: { sellerNoteId: true, value: true } },
          extraNotes: { select: { raw: true, nodeId: true }, orderBy: { createdAt: "asc" } },
        },
        take: 1,
      },
    },
  });
  if (!product) notFound();

  // attributes 안의 lookup id 는 FK 가 없어 조인이 안 된다. 모아서 따로 읽는다
  const ids = collectLookupIds(product.attributes);
  const lookups = ids.length
    ? await prisma.lookupValue.findMany({
        where: { id: { in: ids } },
        select: { id: true, nameKo: true },
      })
    : [];
  const fields = describeProduct(product.attributes, new Map(lookups.map((l) => [l.id, l.nameKo])));

  const experience = product.experiences[0];
  const initial = Object.fromEntries(
    (experience?.noteHits ?? []).map((h) => [h.sellerNoteId, h.value]),
  );

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-5">
      <Link href="/" className="inline-flex h-11 items-center text-[14px] text-muted">
        ← 목록
      </Link>

      <header className="mt-1">
        <div className="text-[13px] text-muted">{product.vendor.name}</div>
        <h1 className="mt-0.5 text-[22px] font-semibold leading-tight text-ink">{product.name}</h1>
        {experience && (
          <div className="mt-1 text-[12px] text-muted-soft">
            {fmt(experience.createdAt)} 기록
            {fmt(experience.updatedAt) !== fmt(experience.createdAt) &&
              ` · ${fmt(experience.updatedAt)} 수정`}
          </div>
        )}
      </header>

      {fields.length > 0 && (
        <dl className="mt-4 rounded-[10px] bg-surface-card px-4 py-3">
          {fields.map((f) => (
            <div key={f.label} className="flex gap-3 py-1">
              <dt className="w-[64px] shrink-0 text-[13px] text-muted">{f.label}</dt>
              <dd className="text-[14px] text-body">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <hr className="my-6 border-hairline-soft" />

      <NoteCycle
        productId={product.id}
        notes={product.sellerNotes}
        initial={initial}
        initialExtra={experience?.extraNotes ?? []}
        hasRecord={!!experience}
      />
    </main>
  );
}
