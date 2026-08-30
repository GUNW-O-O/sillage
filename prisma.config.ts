// Prisma 7 은 config 파일 평가 시 .env 를 자동 주입하지 않는다. 직접 로드한다.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // 마이그레이션은 항상 direct 연결로 나간다 — 설계 8장 함정 ①.
    // 로컬에서는 DATABASE_URL 과 같은 값이고, 원격에서만 갈라진다.
    url: env("DIRECT_URL"),
  },
});
