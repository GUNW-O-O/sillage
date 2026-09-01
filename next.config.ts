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
  // next dev 가 에이전트를 감지하면 AGENTS.md · CLAUDE.md 를 만들고, 지워도 다시 만든다.
  // 이 레포는 작업 규칙을 .claude.local.md 에 두고 그것을 gitignore 한다 —
  // 퍼블릭 레포라 에이전트 설정을 커밋하지 않는다. 생성 자체를 끈다
  agentRules: false,
  allowedDevOrigins: [
    "183.102.*.*",
    "192.168.*.*",
    "172.16.*.*",
    "10.*.*.*",
    ...devOrigins,
  ],
};

export default nextConfig;
