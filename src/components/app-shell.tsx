"use client";

import { useState } from "react";

import { AddSheet } from "./add-sheet";

const NAV = [
  { label: "원두 목록", href: "/" },
  { label: "어드민", href: "/admin" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      {/* 헤더가 없다. 목록이 화면 꼭대기부터 시작하고, 조작은 하단 플로팅 둘뿐이다.
          엄지가 닿는 자리에 두려고 아래로 내렸다 — 위쪽 플로팅은 목록 상단을 가린다. */}
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pb-28">{children}</main>

      {/* 좌 — 메뉴. 보조 액션이라 표면 톤으로 */}
      <button
        type="button"
        aria-label="메뉴"
        onClick={() => setMenuOpen(true)}
        className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-4 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-surface-raised shadow-[0_2px_8px_rgba(20,20,19,.08)]"
      >
        <span className="flex w-5 flex-col gap-[5px]">
          <span className="h-[1.5px] w-full bg-ink" />
          <span className="h-[1.5px] w-full bg-ink" />
          <span className="h-[1.5px] w-full bg-ink" />
        </span>
      </button>

      {/* 우 — 기록 추가. 이 화면의 주 액션이라 CTA 색 */}
      <button
        type="button"
        aria-label="원두 추가"
        onClick={() => setAddOpen(true)}
        className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-cta text-[28px] leading-none text-on-cta shadow-[0_2px_8px_rgba(20,20,19,.08)] active:bg-cta-pressed"
      >
        +
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/25"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <nav className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-canvas shadow-[0_2px_8px_rgba(20,20,19,.08)]">
            <div className="flex h-16 items-center px-4">
              <span className="font-serif text-[22px] text-ink">실라주</span>
            </div>
            <ul className="p-2">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a
                    href={n.href}
                    className="flex min-h-12 items-center rounded-[10px] px-3 text-[16px] text-body"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}

      {addOpen && <AddSheet onClose={() => setAddOpen(false)} />}
    </>
  );
}
