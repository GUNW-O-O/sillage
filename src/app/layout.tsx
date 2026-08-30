import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

// 명조는 앱 이름과 화면 제목에만 쓴다.
//
// next/font/google 의 Noto Serif KR 은 한글 서브셋을 제공하지 않고(latin 계열뿐),
// fontsource 판은 unicode-range 분할이 없는 1MB 단일 파일이다. 그래서 실제로 쓰는
// 글자만 뽑아 자체 서브셋으로 들고 있다 — 997KB -> 9.5KB (`npm run font:subset`).
//
// 여기 없는 글자는 산세로 폴백된다. **명조는 고정 문자열에만 쓴다.**
const serifKr = localFont({
  src: "./fonts/sillage-serif.woff2",
  weight: "500",
  variable: "--font-serif-kr",
  display: "swap",
  // 폴백이 잡히기 전 레이아웃이 튀지 않게
  adjustFontFallback: false,
  fallback: ["serif"],
});

export const metadata: Metadata = {
  title: "실라주",
  description: "판매자가 적은 향 노트와 내가 느낀 것을 대조해 감각 역치를 찾는다",
};

export const viewport: Viewport = {
  themeColor: "#faf9f5",
  // 입력 폰트를 16px 이상으로 두었으므로 확대를 막지 않는다 — 접근성
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${serifKr.variable} antialiased`}>
      <body className="relative flex min-h-dvh flex-col">
        <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
      </body>
    </html>
  );
}
