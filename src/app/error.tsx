"use client";

import Link from "next/link";
import { useEffect } from "react";

import { NoticePage, noticeButton, noticeButtonQuiet } from "@/components/notice-page";

/// 사용자 화면에서 렌더가 터졌을 때. **`digest` 를 보여준다** — 클라이언트에는 원래
/// 메시지가 안 내려오므로(프로덕션에서 지워진다) 서버 로그와 맞춰볼 끈이 이것뿐이다.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <NoticePage title="문제가 생겼어요" body="잠시 뒤에 다시 시도해 주세요.">
      <button type="button" onClick={reset} className={noticeButton}>
        다시 시도
      </button>
      <Link href="/" className={noticeButtonQuiet}>
        목록으로
      </Link>
      {error.digest && (
        <p className="tabular mt-2 w-full text-[12px] text-muted-soft">오류 번호 {error.digest}</p>
      )}
    </NoticePage>
  );
}
