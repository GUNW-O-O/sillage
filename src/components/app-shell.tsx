"use client";

import { useState } from "react";

import { AddSheet } from "./add-sheet";

const NAV = [
  { label: "원두 목록", href: "/" },
  { label: "어드민", href: "/admin" },
  { label: "내보내기", href: "/export" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      {/* 상단 바 — 좌측 햄버거, 우측 + (요구 R1 의 진입점) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hairline bg-surface-raised px-2">
        <button
          type="button"
          aria-label="메뉴"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-[10px]"
        >
          <span className="flex w-5 flex-col gap-[5px]">
            <span className="h-[1.5px] w-full bg-ink" />
            <span className="h-[1.5px] w-full bg-ink" />
            <span className="h-[1.5px] w-full bg-ink" />
          </span>
        </button>

        <span className="font-serif text-[19px] text-ink">실라주</span>

        <button
          type="button"
          aria-label="원두 추가"
          onClick={() => setAddOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[26px] leading-none text-ink"
        >
          +
        </button>
      </header>

      <main className="mx-auto w-full max-w-[560px] flex-1 px-4">{children}</main>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/25"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <nav className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-canvas shadow-[0_2px_8px_rgba(20,20,19,.08)]">
            <div className="flex h-14 items-center border-b border-hairline px-4">
              <span className="font-serif text-[19px] text-ink">실라주</span>
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
