"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { attachNote, createNodeAndAttach, deleteNote, type UnmappedNote } from "@/app/actions";

import { Modal } from "./modal";

type Tree = { id: string; labelKo: string; children: { id: string; labelKo: string }[] }[];

// 미매핑 raw 큐 — 어드민의 주 작업 화면이다 (설계 7-4).
// 같은 raw 는 한 줄로 묶는다. 모아 보는 편이 판단이 정확하다는 것이 이 큐의 전제다.
export function UnmappedQueue({ notes, tree }: { notes: UnmappedNote[]; tree: Tree }) {
  const router = useRouter();
  const [target, setTarget] = useState<{ raw: string; items: UnmappedNote[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const map = new Map<string, UnmappedNote[]>();
    for (const n of notes) {
      const list = map.get(n.raw) ?? [];
      list.push(n);
      map.set(n.raw, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [notes]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했다");
      else {
        setTarget(null);
        router.refresh();
      }
    });

  if (groups.length === 0) {
    return <p className="text-[15px] text-muted">미매핑 노트가 없다.</p>;
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-[10px] border border-hairline bg-surface-card p-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline text-[13px] text-muted">
            <th className="py-2 font-medium">raw</th>
            <th className="py-2 font-medium">쓰인 곳</th>
            <th className="py-2 font-medium">처리</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([raw, items]) => (
            <tr key={raw} className="border-b border-hairline-soft align-top">
              <td className="py-3 pr-4">
                <div className="text-[16px] text-ink">{raw}</div>
                {items.length > 1 && (
                  <div className="text-[12px] text-muted">{items.length}곳에서 쓰임</div>
                )}
              </td>
              <td className="py-3 pr-4 text-[13px] text-muted">
                {items.slice(0, 3).map((i) => (
                  <div key={i.id}>
                    {i.vendorName} · {i.productName}
                  </div>
                ))}
                {items.length > 3 && <div>외 {items.length - 3}곳</div>}
              </td>
              <td className="py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setTarget({ raw, items })}
                    className="inline-flex min-h-10 items-center rounded-[8px] bg-cta px-4 text-[14px] font-medium text-on-cta"
                  >
                    붙이기
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`“${raw}” 를 ${items.length}곳에서 지운다. 되돌릴 수 없다.`)) return;
                      run(async () => {
                        for (const i of items) {
                          const r = await deleteNote(i.id);
                          if (!r.ok) return r;
                        }
                        return { ok: true };
                      });
                    }}
                    className="inline-flex min-h-10 items-center rounded-[8px] border border-hairline px-4 text-[14px] text-danger"
                  >
                    지우기
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {target && (
        <AttachModal
          raw={target.raw}
          count={target.items.length}
          tree={tree}
          pending={pending}
          onClose={() => setTarget(null)}
          onAttach={(nodeId) => run(() => attachNote(target.raw, nodeId))}
          onCreate={(parentId, ko, en) =>
            run(() => createNodeAndAttach(target.raw, parentId, ko, en))
          }
        />
      )}
    </div>
  );
}

// 붙일 노드가 없을 수도 있다 — 기존 어느 L2 에도 안 들어가는 새 향미 범주면
// 여기서 만들고 그 자리에서 붙인다. 다른 화면에 갔다 오면 무엇을 붙이려던 건지 잃는다.
function AttachModal({
  raw,
  count,
  tree,
  pending,
  onClose,
  onAttach,
  onCreate,
}: {
  raw: string;
  count: number;
  tree: Tree;
  pending: boolean;
  onClose: () => void;
  onAttach: (nodeId: string) => void;
  onCreate: (parentId: string, labelKo: string, labelEn: string) => void;
}) {
  const [mode, setMode] = useState<"attach" | "create">("attach");
  const [parentId, setParentId] = useState(tree[0]?.id ?? "");
  // raw 로 미리 채우지 않는다. raw 는 대개 L3 급 표현이라("그래니스미스") 그대로
  // 축 이름이 되면 집계 해상도가 깨진다. 축은 그보다 넓은 이름이어야 한다
  const [labelKo, setKo] = useState("");
  const [labelEn, setEn] = useState("");

  const slug = labelEn.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  return (
    <Modal title="어느 축에 붙일까" subject={raw} onClose={onClose}>
      <p className="mb-3 text-[13px] text-muted">
        이 표현을 쓰는 원두 {count}곳이 함께 붙는다. 집계는 Level 2 에서 한다.
      </p>

      <div className="mb-4 flex gap-2">
        {(["attach", "create"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-[14px] font-medium ${
              mode === m ? "bg-accent text-on-accent" : "border border-hairline text-body"
            }`}
          >
            {m === "attach" ? "기존 축에 붙이기" : "새 축 만들기"}
          </button>
        ))}
      </div>

      {mode === "attach" ? (
        tree.map((l1) => (
          <div key={l1.id} className="mb-4 last:mb-0">
            <div className="mb-1.5 text-[12px] text-muted">{l1.labelKo}</div>
            <div className="flex flex-wrap gap-1.5">
              {l1.children.map((l2) => (
                <button
                  key={l2.id}
                  type="button"
                  disabled={pending}
                  onClick={() => onAttach(l2.id)}
                  className="inline-flex min-h-10 items-center rounded-full border border-hairline bg-surface-raised px-3.5 text-[14px] text-body"
                >
                  {l2.labelKo}
                </button>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div>
          <p className="mb-2 text-[13px] text-muted">
            기존 어느 축에도 안 들어갈 때만 쓴다. 집계는 Level 2 에서 하므로{" "}
            <strong className="text-ink">축은 이 표현보다 넓은 이름</strong>이어야 한다 —
            “그래니스미스”가 아니라 “사과”다.
          </p>
          <p className="mb-3 rounded-[10px] bg-surface-card px-3 py-2 text-[13px] text-body">
            “{raw}” 는 새 축 <strong className="text-ink">{labelKo.trim() || "…"}</strong> 의
            별칭이 된다. 이 표현 자체가 축이면 같은 이름을 써도 된다.
          </p>
          <p className="mb-3 text-[12px] text-muted">
            <strong className="text-ink">id 는 집계 축이라 나중에 못 바꾼다.</strong>
          </p>

          <span className="mb-1.5 block text-[13px] text-muted">부모 (Level 1)</span>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tree.map((l1) => (
              <button
                key={l1.id}
                type="button"
                onClick={() => setParentId(l1.id)}
                className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-[14px] ${
                  parentId === l1.id
                    ? "bg-accent text-on-accent"
                    : "border border-hairline text-body"
                }`}
              >
                {l1.labelKo}
              </button>
            ))}
          </div>

          <label className="mb-3 block">
            <span className="mb-1.5 block text-[13px] text-muted">축 이름 (한글)</span>
            <input
              value={labelKo}
              onChange={(e) => setKo(e.target.value)}
              placeholder="사과"
              className="h-11 w-full rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none placeholder:text-muted-soft"
            />
          </label>
          <label className="mb-3 block">
            <span className="mb-1.5 block text-[13px] text-muted">축 이름 (영문 · id 의 근거)</span>
            <input
              value={labelEn}
              onChange={(e) => setEn(e.target.value)}
              placeholder="Apple"
              className="h-11 w-full rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none placeholder:text-muted-soft"
            />
          </label>
          {slug && (
            <p className="mb-3 text-[12px] text-muted">
              id → <code className="text-ink">{slug}</code>
            </p>
          )}

          <button
            type="button"
            disabled={pending || !labelKo.trim() || !slug}
            onClick={() => onCreate(parentId, labelKo, labelEn)}
            className="h-11 w-full rounded-[10px] bg-cta text-[15px] font-semibold text-on-cta disabled:bg-cta-disabled"
          >
            축 만들고 “{raw}” 붙이기
          </button>
        </div>
      )}
    </Modal>
  );
}
