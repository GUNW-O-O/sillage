"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { approveNoteProposal, rejectNoteProposal, type AdminNoteProposal } from "@/app/actions";

// 노트 추가 제안 큐.
//
// 미매핑 큐와 단위가 다르다. 저쪽은 **표현 하나를 여러 원두에 걸쳐** 축에 붙이는 일이고,
// 여기는 **원두 하나에 노트를 늘리는** 일이다 — 그래서 같은 표현이라도 원두마다 따로 선다.
//
// 올리면 noteSetHash 가 움직인다. 결과가 다른 원두와 같아지면 적용하지 않고 알린다.
// 그때 제안은 큐에 남는다 — 지우면 판단 근거가 사라진다.
//
// **동의 수는 세서 보여주되 자동 승격은 없다.** 임계값은 사람이 붙어 실제 분포를 본 뒤에
// 정한다. 지금 정하면 근거 없는 숫자다 (설계 9장이 별칭 승격 큐를 미뤄둔 것과 같은 기준).
export function ProposalQueue({ proposals }: { proposals: AdminNoteProposal[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했어요");
      else router.refresh();
    });

  if (proposals.length === 0) {
    return <p className="text-[15px] text-muted">대기 중인 제안이 없어요.</p>;
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
            <th className="py-2 font-medium">노트</th>
            <th className="py-2 font-medium">원두</th>
            <th className="py-2 font-medium">동의</th>
            <th className="py-2 font-medium">처리</th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((p) => (
            <tr key={`${p.productId}:${p.normalizedRaw}`} className="border-b border-hairline-soft">
              <td className="py-3 pr-4">
                <div className="text-[16px] text-ink">{p.raw}</div>
                <div className="text-[12px]">
                  {p.nodeLabel ? (
                    <span className="text-muted">{p.nodeLabel}</span>
                  ) : (
                    // 축이 없으면 올려도 unmapped 토큰으로 해시에 들어간다.
                    // 미매핑 큐에서 붙이는 편이 먼저다
                    <span className="text-pending">미매핑 — 축부터 붙이는 편이 나아요</span>
                  )}
                </div>
              </td>
              <td className="py-3 pr-4 text-[13px] text-muted">
                {p.vendorName} · {p.productName}
              </td>
              <td className="tabular py-3 pr-4 text-[13px] text-muted">{p.agreeCount}명</td>
              <td className="py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => approveNoteProposal(p.productId, p.normalizedRaw))}
                    className="inline-flex min-h-10 items-center rounded-[8px] bg-cta px-4 text-[14px] font-medium text-on-cta"
                  >
                    노트로 올리기
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`“${p.raw}” 제안을 지울까요? 동의 ${p.agreeCount}건이 사라져요.`))
                        return;
                      run(() => rejectNoteProposal(p.productId, p.normalizedRaw));
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
    </div>
  );
}
