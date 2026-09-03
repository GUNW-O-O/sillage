import type { ReactNode } from "react";

/// 404 · 에러 화면의 공용 몸통. 셋이 같은 모양을 쓰므로 마크업을 여기 한 곳에 둔다 —
/// **어드민 에러 화면이 404 와 글자 하나까지 같아야 하기 때문이다** (설계 4-2).
/// 다른 화면이 뜨는 것 자체가 "여기 어드민이 있다" 를 알려준다.
///
/// 서버 · 클라이언트 양쪽에서 쓴다. `"use client"` 를 안 붙이는 이유가 그것이다 —
/// 붙이면 not-found.tsx 까지 클라이언트 번들로 끌려간다.
export function NoticePage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-8 text-center">
      <h1 className="font-serif text-[26px] text-ink">{title}</h1>
      <p className="mt-3 max-w-[320px] text-[15px] leading-relaxed text-muted">{body}</p>
      {children && <div className="mt-8 flex flex-wrap justify-center gap-2">{children}</div>}
    </main>
  );
}

export const noticeButton =
  "flex h-12 min-w-[120px] items-center justify-center rounded-[10px] bg-cta px-5 text-[16px] font-semibold text-on-cta active:bg-cta-pressed";

export const noticeButtonQuiet =
  "flex h-12 min-w-[120px] items-center justify-center rounded-[10px] border border-hairline bg-canvas px-5 text-[15px] text-ink";
