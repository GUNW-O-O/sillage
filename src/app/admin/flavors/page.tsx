import { listFlavorTree } from "@/app/actions";

// 향 계층. 집계 축이라 id 는 고정이고, 어드민이 만질 수 있는 것은
// 노드 추가 · 위치 변경 · 라벨 수정뿐이다 (설계 7-4).
// 삭제는 화면을 만들지 않는다 — FK 가 이미 막고 있고, 참조가 0이어도 웹에서 할 일이 아니다.
// L1 아홉 개는 골격이라 추가 · 이동 · 삭제 전부 막는다.
export const dynamic = "force-dynamic";

export default async function FlavorsPage() {
  const tree = await listFlavorTree();

  return (
    <main className="max-w-[1000px]">
      <h1 className="font-serif text-[26px] text-ink">향 계층</h1>
      <p className="mt-2 mb-6 text-[13px] text-muted">
        집계는 Level 2 에서 한다. Level 3 는 미리 만들지 않고 NoteAlias 의 raw 축적에서
        자란다. L1 아홉 개는 골격이라 건드리지 않는다.
      </p>

      <div className="grid grid-cols-3 gap-4">
        {tree.map((l1) => (
          <section key={l1.id} className="rounded-[10px] border border-hairline bg-surface-raised p-4">
            <div className="text-[15px] font-semibold text-ink">{l1.labelKo}</div>
            <div className="text-[11px] text-muted-soft">{l1.id}</div>
            <ul className="mt-3 space-y-1">
              {l1.children.map((l2) => (
                <li key={l2.id} className="flex items-baseline justify-between">
                  <span className="text-[14px] text-body">{l2.labelKo}</span>
                  <span className="text-[11px] text-muted-soft">{l2.id}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-[13px] text-muted">
        노드 추가 · 위치 변경 · 라벨 수정은 아직 붙이지 않았다. 미매핑 큐에서 붙일 노드가
        없을 때 필요해진다.
      </p>
    </main>
  );
}
