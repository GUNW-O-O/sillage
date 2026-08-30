"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { attachNote, deleteNote, type UnmappedNote } from "@/app/actions";

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
        <Modal
          title="어느 축에 붙일까"
          subject={target.raw}
          onClose={() => setTarget(null)}
        >
          <p className="mb-4 text-[13px] text-muted">
            이 표현을 쓰는 원두 {target.items.length}곳이 함께 붙는다. 집계는 Level 2 에서 한다.
          </p>
          {tree.map((l1) => (
            <div key={l1.id} className="mb-4 last:mb-0">
              <div className="mb-1.5 text-[12px] text-muted">{l1.labelKo}</div>
              <div className="flex flex-wrap gap-1.5">
                {l1.children.map((l2) => (
                  <button
                    key={l2.id}
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => attachNote(target.raw, l2.id))}
                    className="inline-flex min-h-10 items-center rounded-full border border-hairline bg-surface-raised px-3.5 text-[14px] text-body"
                  >
                    {l2.labelKo}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
