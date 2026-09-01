import Link from "next/link";
import { notFound } from "next/navigation";

import { getProductDetail, listProductProposals } from "@/app/actions";
import { NoteProposals } from "@/components/note-proposals";
import { ProductNotesEditor } from "@/components/product-notes-editor";
import { ProductSpecEditor } from "@/components/product-spec-editor";

// 원두 상세 — 이 원두의 판매자 노트가 무엇이고 사람들이 무엇을 느꼈나.
// Product 은 공유 자산이라 수정을 누구나 한다 (설계 4-3 편집 모델 개정).
export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const product = await getProductDetail(id);
  if (!product) notFound();
  const proposals = await listProductProposals(id);

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-5 pb-24">
      <Link href="/" className="inline-flex h-11 items-center text-[14px] text-muted">
        ← 목록
      </Link>

      <header className="mt-1">
        <div className="text-[16px] text-muted">{product.vendorName}</div>
        {/* 화면 제목은 명조다 (DESIGN 타입 위계). 명조로 가면서 굵기는 뺀다 —
            강조는 크기 먼저, 굵기 나중 */}
        <h1 className="mt-0.5 font-serif text-[28px] leading-tight tracking-[-0.4px] text-ink">
          {product.name}
        </h1>
      </header>

      <ProductSpecEditor
        productId={product.id}
        attributes={product.attributes}
        fields={product.fields}
      />

      <hr className="my-6 border-hairline-soft" />

      <ProductNotesEditor
        productId={product.id}
        name={product.name}
        notes={product.notes}
        sampleSize={product.sampleSize}
        peopleExtraNotes={product.peopleExtraNotes}
      />

      <NoteProposals productId={product.id} proposals={proposals} />

      <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface-raised">
        <div className="mx-auto w-full max-w-[560px] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <Link
            href={`/products/${product.id}/record`}
            className="flex h-12 w-full items-center justify-center rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta"
          >
            {product.hasMyRecord ? "내 기록 보기" : "기록 입력"}
          </Link>
        </div>
      </div>
    </main>
  );
}
