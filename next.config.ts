import type { NextConfig } from "next";

// 내부망(폰)에서 dev 서버에 붙으면 Next 가 /_next/* 요청을 cross-origin 으로 막는다.
// 접속하는 기기의 origin 을 허용 목록에 넣어야 한다.
//
// 정확한 주소는 환경마다 다르므로 .env 의 DEV_ORIGINS 로 넣는다 (쉼표 구분).
//   DEV_ORIGINS="183.102.12.34,192.168.0.7"
// 와일드카드가 안 먹으면 정확한 IP 를 넣는 쪽이 확실하다.
const devOrigins = (process.env.DEV_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [
    "183.102.*.*",
    "192.168.*.*",
    "172.16.*.*",
    "10.*.*.*",
    ...devOrigins,
  ],
};

export default nextConfig;
