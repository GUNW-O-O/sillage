"use client";

import { useEffect } from "react";

// 어드민 전용 모달. PC 기준이라 가운데 띄운다 (설계 7-4).
// 무엇을 대상으로 하는 조작인지가 항상 보여야 한다 — 제목 아래 subject 자리를 둔다.
export function Modal({
  title,
  subject,
  onClose,
  children,
}: {
  title: string;
  subject?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[80vh] w-full max-w-[560px] flex-col rounded-[14px] bg-canvas shadow-[0_2px_8px_rgba(20,20,19,.08)]">
        <div className="shrink-0 border-b border-hairline px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[13px] text-muted">{title}</div>
              {subject && <div className="mt-1 text-[20px] font-semibold text-ink">{subject}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-[8px] px-2 py-1 text-[14px] text-muted"
            >
              닫기
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
