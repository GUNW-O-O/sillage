import { listFlavorTreeDetailed } from "@/app/actions";
import { FlavorTree } from "@/components/flavor-tree";

// 향 계층. id 는 집계 축이라 고정이고, 어드민이 만질 수 있는 것은 추가와 재매핑뿐이다.
// 삭제는 화면을 만들지 않는다 — FK 가 이미 막고 있고, 참조가 0이어도 웹에서 할 일이 아니다.
// L1 아홉 개는 골격이라 추가 · 이동 · 삭제 전부 막는다 (설계 7-4).
export const dynamic = "force-dynamic";

export default async function FlavorsPage() {
  const tree = await listFlavorTreeDetailed();
  const total = tree.reduce((s, l1) => s + l1.children.reduce((t, c) => t + c.noteCount, 0), 0);
  const empty = tree.reduce(
    (s, l1) => s + l1.children.filter((c) => c.noteCount === 0).length,
    0,
  );

  return (
    <main className="max-w-[1100px]">
      <h1 className="font-serif text-[26px] text-ink">향 계층</h1>
      <p className="mt-2 text-[13px] text-muted">
        집계는 Level 2 에서 한다. 어느 표현이 어느 축에 앉았는지가 여기 다 보인다 —
        잘못 붙인 것을 찾는 방법이 이것뿐이다. 표현을 누르면 다른 축으로 옮기거나
        매핑을 지워 미매핑 큐로 되돌린다.
      </p>
      <p className="mt-1 mb-6 text-[13px] text-muted">
        매핑된 노트 <span className="tabular text-ink">{total}</span> · 아직 안 쓰인 축{" "}
        <span className="tabular text-ink">{empty}</span>
      </p>

      <FlavorTree tree={tree} />
    </main>
  );
}
