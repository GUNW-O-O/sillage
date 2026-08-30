import { listFlavorTree, listUnmappedNotes } from "@/app/actions";
import { UnmappedQueue } from "@/components/unmapped-queue";

// 어드민은 PC 전용이다 (설계 7-4). 반응형 대상에서 빼면 표와 폼으로 끝난다.
//
// 접근 통제는 서버가 한다 — 공개 URL 이라 경로만 알면 요청이 들어온다.
// 지금은 로그인이 없어(요구 FR-10, 배포 시점) 통제할 대상이 없다.
// 세션이 붙는 순간 여기와 모든 어드민 액션에서 role = admin 을 확인해야 한다.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [notes, tree] = await Promise.all([listUnmappedNotes(), listFlavorTree()]);

  return (
    <main className="mx-auto w-full max-w-[1000px] px-6 py-8">
      <h1 className="font-serif text-[28px] text-ink">어드민</h1>
      <p className="mt-2 text-[13px] text-muted">
        등록 폼에서 노트 분류를 뺐으므로 미매핑 raw 가 여기 쌓인다. 처리하는 곳이 여기뿐이다.
      </p>

      <section className="mt-8">
        <h2 className="text-[19px] font-semibold text-ink">
          미매핑 노트 <span className="tabular text-muted">{notes.length}</span>
        </h2>
        <p className="mt-1 mb-4 text-[13px] text-muted">
          붙이면 그 표현을 쓰는 모든 원두가 함께 붙고 noteSetHash 가 재계산된다.
        </p>
        <UnmappedQueue notes={notes} tree={tree} />
      </section>
    </main>
  );
}
