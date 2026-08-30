import { listFlavorTree, listUnmappedNotes } from "@/app/actions";
import { UnmappedQueue } from "@/components/unmapped-queue";

export const dynamic = "force-dynamic";

export default async function UnmappedPage() {
  const [notes, tree] = await Promise.all([listUnmappedNotes(), listFlavorTree()]);

  return (
    <main className="max-w-[1000px]">
      <h1 className="font-serif text-[26px] text-ink">미매핑 노트</h1>
      <p className="mt-2 mb-6 text-[13px] text-muted">
        같은 표현은 한 줄로 묶인다. 붙이면 그 표현을 쓰는 모든 원두가 함께 붙고
        noteSetHash 가 재계산된다. 재계산 결과 다른 원두와 키가 같아지면 적용하지 않고 알린다.
      </p>
      <UnmappedQueue notes={notes} tree={tree} />
    </main>
  );
}
