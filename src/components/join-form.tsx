"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { redeemInviteCode } from "@/app/actions";

const LENGTH = 6;

/// 초대 코드 교환 (설계 10-3).
///
/// **입력이 코드 하나뿐이다.** 이름 칸을 두지 않는다 — 발급할 때 어드민이 적은
/// `label` 이 그대로 표시명이 된다 (설계 5-3).
export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await redeemInviteCode(code);
      if (!result.ok) {
        setError(result.message);
        setCode("");
        return;
      }
      // 세션 쿠키는 액션 응답에 실려 이미 구워졌다. 여기서는 이동만 한다 —
      // refresh 를 같이 부르지 않으면 캐시된 RSC 가 로그인 전 상태로 그려질 수 있다
      router.replace("/");
      router.refresh();
    });
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-8 text-center">
      <h1 className="font-serif text-[26px] text-ink">실라주</h1>
      <p className="mt-3 max-w-[320px] text-[15px] leading-relaxed text-muted">
        받은 초대 코드를 넣어 주세요.
      </p>

      <input
        value={code}
        // **숫자만 남긴다.** 어드민이 읽어 준 코드를 받아 적다 보면 공백이나 하이픈이 섞인다
        onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, LENGTH))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && code.length === LENGTH && !pending) submit();
        }}
        // 폰 키패드를 숫자로 연다. type="number" 는 스피너와 스크롤 증감이 붙어 안 쓴다
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="000000"
        aria-label="초대 코드"
        className="mt-8 h-12 w-[200px] rounded-[10px] bg-surface-sunken text-center text-[22px] tracking-[0.3em] text-ink outline-none placeholder:text-muted-soft"
      />

      <button
        type="button"
        disabled={pending || code.length !== LENGTH}
        onClick={submit}
        className="mt-4 flex h-12 w-[200px] items-center justify-center rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed disabled:bg-cta-disabled"
      >
        시작
      </button>

      {/* 자리를 미리 비워두지 않는다. 오류가 뜰 때 버튼이 밀려 올라가는 편이
          빈 줄이 늘 떠 있는 것보다 낫다 — 이 화면은 요소가 셋뿐이라 흔들림이 안 보인다 */}
      {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
    </main>
  );
}
