import { notFound } from "next/navigation";

import { ProductForm } from "@/components/product-form";
import { prisma } from "@/lib/db";

// 시트가 아니라 라우트다 — 타이핑이 길어 새로고침 · 뒤로가기로 날아가면 손해가 크다.
export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: PageProps<"/products/new">) {
  const params = await searchParams;
  const vendorId = typeof params.vendorId === "string" ? params.vendorId : null;
  const initialName = typeof params.name === "string" ? params.name : "";
  if (!vendorId) notFound();

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true },
  });
  if (!vendor) notFound();

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-6">
      <h1 className="mb-4 font-serif text-[22px] text-ink">원두 등록</h1>
      <ProductForm vendorId={vendor.id} vendorName={vendor.name} initialName={initialName} />
    </main>
  );
}
