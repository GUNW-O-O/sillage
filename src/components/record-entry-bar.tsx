"use client";

import Link from "next/link";
import { useState } from "react";

import { RecordSheet } from "./record-sheet";

// 원두 상세 아래 고정 바. **이미 기록이 있으면 시트로 연다** — 목록에서와 같은 규칙이다
// (record-list.tsx): 기록을 여는 것은 「보러」 여는 것이라 라우트로 나가지 않는다.
// 라우트로 나가면 방금 보던 원두 정보와 남들의 판정을 잃고, 돌아오려면 뒤로가기를 눌러야 한다.
//
// **처음 기록하는 것은 작업이라 라우트를 그대로 쓴다.** 타이핑이 길고 중간에 잃으면
// 손해가 커서 시트에 담을 일이 아니다 — 등록 직후와 검색 진입이 같은 이유로 라우트다.
export function RecordEntryBar({
  productId,
  hasMyRecord,
}: {
  productId: string;
  hasMyRecord: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cls =
    "flex h-12 w-full items-center justify-center rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta";

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface-raised">
      <div className="mx-auto w-full max-w-[560px] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        {hasMyRecord ? (
          <button type="button" onClick={() => setOpen(true)} className={cls}>
            내 기록 보기
          </button>
        ) : (
          <Link href={`/products/${productId}/record`} className={cls}>
            기록 입력
          </Link>
        )}
      </div>

      {open && <RecordSheet productId={productId} onClose={() => setOpen(false)} />}
    </div>
  );
}
