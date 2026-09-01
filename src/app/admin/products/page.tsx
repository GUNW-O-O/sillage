import { AdminProductNotes } from "@/components/admin-product-notes";

export const dynamic = "force-dynamic";

export default function AdminProductsPage() {
  return (
    <main className="max-w-[1000px]">
      <h1 className="font-serif text-[26px] text-ink">원두 노트</h1>
      <p className="mt-2 mb-6 text-[13px] text-muted">
        노트 추가 · 삭제는 여기서 한다. 둘 다 noteSetHash 를 움직여 다른 원두와 키가 충돌할 수
        있고, 충돌하면 적용하지 않고 알린다. 표기가 틀린 노트는 지우지 말고{" "}
        <span className="text-ink">원두 화면에서 고쳐 쓴다</span> — 그쪽은 nodeId 가 그대로라
        판정이 안 깨진다.
      </p>
      <AdminProductNotes />
    </main>
  );
}
