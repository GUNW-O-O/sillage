"use client";

import { useState } from "react";

import { RecordSheet } from "./record-sheet";

export type RecordRow = {
  id: string;
  productId: string;
  productName: string;
  vendorName: string;
  noteCount: number;
  hitCount: number;
  freshCount: number;
};

// 목록에서 기록을 여는 것은 "보러" 여는 것이라 라우트로 나가지 않는다.
// 등록 직후와 검색 진입은 작업이라 라우트를 그대로 쓴다.
export function RecordList({ records }: { records: RecordRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <p className="pb-2 text-[12px] text-muted-soft">느낀 노트 / 판매자 노트</p>
      <ul>
        {records.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setOpen(r.productId)}
              className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-hairline-soft py-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-semibold text-ink">
                  {r.productName}
                </span>
                <span className="mt-0.5 block text-[13px] text-muted">{r.vendorName}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {/* 기록 이후 추가된 노트. 강조색을 안 쓰는 이유는 그것이 판정 강도를
                    뜻하기 때문이다 — 여기는 "손이 필요하다"는 뜻이라 pending 을 쓴다 */}
                {r.freshCount > 0 && (
                  <span className="tabular rounded-full bg-pending px-2 py-0.5 text-[11px] font-medium text-on-accent">
                    새 노트 {r.freshCount}
                  </span>
                )}
                <span className="tabular text-[13px] text-muted">
                  <span className="text-accent">{r.hitCount}</span>
                  {" / "}
                  {r.noteCount}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && <RecordSheet productId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
