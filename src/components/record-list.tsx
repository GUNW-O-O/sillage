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
              <span className="tabular shrink-0 text-[13px] text-muted">
                <span className="text-accent">{r.hitCount}</span>
                {" / "}
                {r.noteCount}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && <RecordSheet productId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
