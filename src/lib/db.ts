import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// 설계 8장 함정 ① — 함수 인스턴스마다 커넥션을 열면 max_connections 를 넘긴다.
// 로컬에서는 문제가 안 보이므로 처음부터 pooler 를 전제로 짠다.
// DATABASE_URL 은 배포 시 Supavisor 트랜잭션 pooler(:6543, ?pgbouncer=true)로 바뀐다.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL 이 없다");

const createClient = () =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// 개발 중 HMR 이 커넥션을 계속 새로 열지 않게 전역에 붙인다.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
