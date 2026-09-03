"use client";

import Link from "next/link";
import { useEffect } from "react";

import { NoticePage, noticeButton } from "@/components/notice-page";

/// **404 화면과 글자 하나까지 같다.** 어드민 페이지가 렌더 중에 던지는 가장 흔한 이유가
/// `requireAdmin()` 의 거절인데, 그때 다른 화면이 뜨면 그 화면 자체가 "여기 어드민이
/// 있다" 를 알려준다 (설계 4-2). 레이아웃의 `notFound()` 와 페이지의 throw 는 경쟁하므로
/// 어느 쪽이 이겨도 같은 것이 보여야 한다.
///
/// 그래서 **다시 시도 버튼을 안 그린다** — 404 에는 없는 버튼이다. 진짜 장애였다면
/// 어드민은 서버 로그에서 본다.
export default function AdminError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <NoticePage title="찾는 페이지가 없어요" body="주소가 바뀌었거나 지워진 페이지예요.">
      <Link href="/" className={noticeButton}>
        목록으로
      </Link>
    </NoticePage>
  );
}
