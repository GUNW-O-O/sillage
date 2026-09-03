"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { remapAlias, unmapAlias, type FlavorTreeNode } from "@/app/actions";

import { AddFlavorNode } from "./admin-create";
import { Modal } from "./modal";

type L1 = FlavorTreeNode & { children: FlavorTreeNode[] };

// 어느 표현이 어느 축에 앉았는지 보이는 것이 잘못 붙인 것을 찾는 유일한 방법이다.
// 그래서 계층만 보여주지 않고 붙은 별칭을 노드 안에 함께 편다 (설계 7-4).
export function FlavorTree({ tree }: { tree: L1[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<{ id: string; raw: string; nodeLabel: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했어요");
      else {
        setTarget(null);
        router.refresh();
      }
    });

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-[10px] border border-hairline bg-surface-card p-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      <div className="space-y-6">
        {tree.map((l1) => (
          <section key={l1.id}>
            <div className="flex items-baseline gap-2 border-b border-hairline pb-1.5">
              <h2 className="text-[17px] font-semibold text-ink">{l1.labelKo}</h2>
              <span className="text-[12px] text-muted-soft">{l1.id}</span>
              <span className="tabular ml-auto text-[12px] text-muted">
                노트 {l1.children.reduce((s, c) => s + c.noteCount, 0)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {l1.children.map((l2) => (
                <div
                  key={l2.id}
                  className="rounded-[10px] border border-hairline bg-surface-raised p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-medium text-ink">{l2.labelKo}</span>
                    <span className="tabular text-[12px] text-muted">{l2.noteCount}</span>
                  </div>
                  <div className="text-[11px] text-muted-soft">{l2.id}</div>

                  {l2.aliases.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {l2.aliases.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              setTarget({ id: a.id, raw: a.raw, nodeLabel: l2.labelKo })
                            }
                            className="inline-flex min-h-8 items-center rounded-full bg-surface-card px-2.5 text-[13px] text-body"
                          >
                            {a.raw}
                            {a.scope === "PERSONAL" && (
                              <span className="ml-1 text-[10px] text-muted-soft">개인</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[12px] text-muted-soft">붙은 표현이 없어요</p>
                  )}
                </div>
              ))}
            </div>

            <AddFlavorNode parentId={l1.id} parentLabel={l1.labelKo} />
          </section>
        ))}
      </div>

      {target && (
        <Modal
          title={`「${target.nodeLabel}」 에 붙어 있어요`}
          subject={target.raw}
          onClose={() => setTarget(null)}
        >
          <p className="mb-4 text-[13px] text-muted">
            옮기면 이 표현을 쓰는 판매자 노트가 함께 옮겨지고 noteSetHash 가 재계산돼요.
            <strong className="text-ink"> 판정값은 그대로예요</strong> — 축이 바뀐 것이지 판정이
            바뀐 게 아니에요.
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
                    onClick={() => run(() => remapAlias(target.id, l2.id))}
                    className="inline-flex min-h-10 items-center rounded-full border border-hairline bg-surface-raised px-3.5 text-[14px] text-body"
                  >
                    {l2.labelKo}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`“${target.raw}” 의 매핑을 지울까요? 미매핑 큐로 돌아가요.`)) return;
              run(() => unmapAlias(target.id));
            }}
            className="mt-5 h-11 w-full rounded-[10px] border border-hairline text-[15px] text-danger"
          >
            매핑 지우고 미매핑 큐로
          </button>
        </Modal>
      )}
    </div>
  );
}
