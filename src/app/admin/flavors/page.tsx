import { listFlavorTreeDetailed } from "@/app/actions";
import { FlavorTree } from "@/components/flavor-tree";

// 향 계층. id 는 집계 축이라 고정이고, 어드민이 만질 수 있는 것은 추가 · 라벨 · 부모 · 재매핑이다.
// 삭제는 화면을 만들지 않는다 — FK 가 이미 막고 있고, 참조가 0이어도 웹에서 할 일이 아니다.
// L1 아홉 개는 골격이라 추가 · 삭제 · 레벨 변경을 막는다 (설계 7-4). 라벨은 고칠 수 있다 —
// 계층을 손보는 수단이 seed 재작성뿐이면 이미 도는 DB 에 닿을 방법이 없다 (설계 2026-09-08 §7).
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
        어느 표현이 어느 축에 앉았는지가 여기 다 보여요 — 잘못 붙인 것을 찾는 방법은
        이것뿐이에요. 표현을 누르면 다른 축으로 옮기거나 매핑을 지워 미매핑 큐로 되돌릴 수
        있어요. 노드의 라벨과 부모는 「고치기」로 바꿔요. 옮겨도 판정값은 그대로예요.
      </p>
      <p className="mt-1 text-[13px] text-muted">
        매핑된 노트 <span className="tabular text-ink">{total}</span> · 아직 안 쓰인 축{" "}
        <span className="tabular text-ink">{empty}</span>
      </p>

      {/* 색이 어디서 왔는지가 안 보이면 「띠가 온통 한 색」의 원인을 못 찾는다 */}
      <p className="mt-2 mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full bg-ink" />
          제 색
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full border-2 border-ink" />
          부모에서 물려받음
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full border border-dashed border-muted-soft" />
          색 없음 — 띠에서 빠져요
        </span>
      </p>

      <FlavorTree tree={tree} />
    </main>
  );
}
