import Link from "next/link";
import { notFound } from "next/navigation";

import { getProductDetail } from "@/app/actions";
import { ProductNotesEditor } from "@/components/product-notes-editor";

// 원두 상세 — 이 원두의 판매자 노트가 무엇이고 사람들이 무엇을 느꼈나.
// Product 은 공유 자산이라 수정을 누구나 한다 (설계 4-3 편집 모델 개정).
export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const product = await getProductDetail(id);
  if (!product) notFound();

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-5 pb-24">
      <Link href="/" className="inline-flex h-11 items-center text-[14px] text-muted">
        ← 목록
      </Link>

      <header className="mt-1">
        <div className="text-[13px] text-muted">{product.vendorName}</div>
        <h1 className="mt-0.5 text-[22px] font-semibold leading-tight text-ink">{product.name}</h1>
      </header>

      {product.fields.length > 0 && (
        <dl className="mt-4 rounded-[10px] bg-surface-card px-4 py-3">
          {product.fields.map((f) => (
            <div key={f.label} className="flex gap-3 py-1">
              <dt className="w-[64px] shrink-0 text-[13px] text-muted">{f.label}</dt>
              <dd className="text-[14px] text-body">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <hr className="my-6 border-hairline-soft" />

      <ProductNotesEditor
        productId={product.id}
        name={product.name}
        notes={product.notes}
        sampleSize={product.sampleSize}
      />

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
