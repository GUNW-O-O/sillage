"use client";

import { useEffect } from "react";

/// 루트 레이아웃이 터진 자리다. **여기는 레이아웃 밖이라 `<html>` 과 `<body>` 를 직접 낸다.**
/// 폰트 변수도 globals.css 도 안 걸린 상태일 수 있어 색과 글꼴을 인라인으로 박는다 —
/// 토큰을 참조하면 아무것도 안 칠해진 화면이 나온다.
export default function GlobalError({
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
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#faf9f5",
          color: "#141413",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "0 32px",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>문제가 생겼어요</h1>
        <p style={{ fontSize: 15, color: "#6c6a64", margin: 0 }}>잠시 뒤에 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 12,
            height: 48,
            minWidth: 120,
            border: 0,
            borderRadius: 10,
            background: "#453c31",
            color: "#faf9f5",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
