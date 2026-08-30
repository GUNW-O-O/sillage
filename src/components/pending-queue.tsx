"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  approveLookup,
  approveVendor,
  mergeLookup,
  type PendingLookup,
  type PendingVendor,
} from "@/app/actions";

const KIND_LABEL: Record<string, string> = {
  COUNTRY: "나라",
  VARIETY: "품종",
  PROCESS: "가공",
};

// 인라인 추가된 값은 pending 으로 들어온다 (설계 4-8).
// 어드민이 승인하거나 기존 값에 흡수시킨다 — 병합의 실체는 삭제가 아니라 흡수다.
export function PendingQueue({
  vendors,
  lookups,
  options,
}: {
  vendors: PendingVendor[];
  lookups: PendingLookup[];
  options: Record<string, { id: string; nameKo: string }[]>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했다");
      else {
        setMergeTarget(null);
        router.refresh();
      }
    });

  const empty = vendors.length === 0 && lookups.length === 0;
  if (empty) return <p className="text-[15px] text-muted">승인 대기 항목이 없다.</p>;

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-[10px] border border-hairline bg-surface-card p-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      {vendors.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-[16px] font-semibold text-ink">로스터리</h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline text-[13px] text-muted">
                <th className="py-2 font-medium">이름</th>
                <th className="py-2 font-medium">원두</th>
                <th className="py-2 font-medium">처리</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-b border-hairline-soft">
                  <td className="py-3 text-[16px] text-ink">{v.name}</td>
                  <td className="tabular py-3 text-[14px] text-muted">{v.productCount}</td>
                  <td className="py-3">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => approveVendor(v.id))}
                      className="inline-flex min-h-10 items-center rounded-[8px] bg-cta px-4 text-[14px] font-medium text-on-cta"
                    >
                      승인
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {lookups.length > 0 && (
        <section>
          <h2 className="mb-2 text-[16px] font-semibold text-ink">품종 · 가공</h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline text-[13px] text-muted">
                <th className="py-2 font-medium">종류</th>
                <th className="py-2 font-medium">이름</th>
                <th className="py-2 font-medium">처리</th>
              </tr>
            </thead>
            <tbody>
              {lookups.map((l) => (
                <tr key={l.id} className="border-b border-hairline-soft align-top">
                  <td className="py-3 text-[13px] text-muted">{KIND_LABEL[l.kind] ?? l.kind}</td>
                  <td className="py-3 text-[16px] text-ink">{l.nameKo}</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => approveLookup(l.id))}
                        className="inline-flex min-h-10 items-center rounded-[8px] bg-cta px-4 text-[14px] font-medium text-on-cta"
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setMergeTarget(mergeTarget === l.id ? null : l.id)}
                        className="inline-flex min-h-10 items-center rounded-[8px] border border-hairline px-4 text-[14px] text-body"
                      >
                        기존 값에 흡수
                      </button>
                    </div>

                    {mergeTarget === l.id && (
                      <div className="mt-3 max-h-[240px] overflow-y-auto rounded-[10px] border border-hairline bg-surface-card p-3">
                        <p className="mb-2 text-[12px] text-muted">
                          흡수할 대상을 고른다. “{l.nameKo}” 는 그 항목의 별칭이 되고,
                          이미 이 값을 쓰는 원두는 대상으로 갈아탄다.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(options[l.kind] ?? []).map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              disabled={pending}
                              onClick={() => run(() => mergeLookup(l.id, o.id))}
                              className="inline-flex min-h-9 items-center rounded-full border border-hairline bg-canvas px-3 text-[13px] text-body"
                            >
                              {o.nameKo}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
