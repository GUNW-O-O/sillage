"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  proposeSellerNote,
  withdrawNoteProposal,
  type NoteInput,
  type NoteProposal,
} from "@/app/actions";

import { NoteChips } from "./note-input";

// 판매자가 봉투에 적었는데 빠진 노트를 사용자가 제안한다.
//
// **바로 노트가 되지 않는다.** 노트는 Product 동일성 키의 절반이라(`noteSetHash`)
// 사람마다 다르게 보일 수 없다 — `pending` 로스터리처럼 "낸 사람에게는 즉시 보인다" 를
// 못 한다. 올리는 것은 어드민이고, 그 전까지는 여기에만 뜬다.
//
// **동의를 누를 자리가 여기다.** 같은 표현을 다른 사람이 또 내는 것이 곧 동의 1이다.
// 이 버튼이 없으면 동의가 모일 경로가 없다.
export function NoteProposals({
  productId,
  proposals,
}: {
  productId: string;
  proposals: NoteProposal[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<NoteInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했다");
      else router.refresh();
    });

  const submit = () =>
    startTransition(async () => {
      setError(null);
      for (const d of drafts) {
        const r = await proposeSellerNote(productId, d.raw, d.nodeId);
        if (!r.ok) {
          setError(r.message);
          return;
        }
      }
      setDrafts([]);
      router.refresh();
    });

  return (
    <section className="mt-8">
      <h2 className="text-[16px] font-semibold text-ink">빠진 노트 제안</h2>
      <p className="mt-1 text-[13px] text-muted">
        봉투에 있는데 여기 없는 노트를 적는다. <span className="text-ink">내가 느낀 향이
        아니다</span> — 그건 기록 화면에서 적는다. 제안은 어드민이 확인한 뒤 노트가 된다.
      </p>

      {error && (
        <p className="mt-3 rounded-[10px] border border-hairline bg-surface-card p-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      {proposals.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {proposals.map((p) => (
            <li key={p.normalizedRaw}>
              {/* 같은 표현을 또 내는 것이 동의다. 이미 냈으면 거두는 버튼이 된다 */}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    p.mine
                      ? withdrawNoteProposal(productId, p.normalizedRaw)
                      : proposeSellerNote(productId, p.raw, p.nodeId),
                  )
                }
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-[14px] text-[14px] font-medium ${
                  p.mine
                    ? "bg-accent-tint text-accent-pressed"
                    : "border border-dashed border-hairline text-body"
                }`}
              >
                {p.raw}
                {!p.nodeId && <span className="text-[11px] text-pending">미매핑</span>}
                <span className="tabular text-[12px] opacity-80">동의 {p.agreeCount}</span>
                <span className="text-[12px] opacity-70">{p.mine ? "거두기" : "나도"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <NoteChips notes={drafts} onChange={setDrafts} placeholder="봉투에 있는데 빠진 노트" />
        {drafts.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="mt-3 h-11 w-full rounded-[10px] bg-cta text-[15px] font-semibold text-on-cta disabled:bg-cta-disabled"
          >
            {drafts.length}개 제안
          </button>
        )}
      </div>
    </section>
  );
}
