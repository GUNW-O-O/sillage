// 근접 검색이 성립하는 전제들. **전부 조용히 깨지는 종류다** — 인덱스가 없어도,
// 로케일이 틀려도 쿼리는 에러 없이 돌고 결과만 느려지거나 빈다.
//
// 특히 인덱스: raw SQL 마이그레이션으로 만든 GIN 인덱스를 Prisma 가 드리프트로 보고
// 지운 전례가 있다 (20260830105447 이 만든 것을 20260830124500 이 전부 DROP).
// 지금은 schema.prisma 안에 있어서 안 지워지지만, 그 사실을 여기서 지킨다.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { MIN_QUERY_LENGTH } from "../src/lib/search-tuning";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

let failed = 0;
const ok = (cond: boolean, label: string) => {
  if (!cond) failed += 1;
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
};

/// 검색이 훑는 컬럼과, 그것을 쓰는 화면
const INDEXED = [
  { table: "Vendor", column: "normalizedName", why: "로스터리 검색" },
  { table: "Product", column: "normalizedName", why: "원두명 검색" },
  { table: "NoteAlias", column: "normalizedRaw", why: "노트 자동완성" },
];

async function main() {
  // ── pg_trgm 이 없으면 % 와 similarity 가 아예 없는 함수가 된다
  const ext = await prisma.$queryRaw<{ extname: string }[]>`
    SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
  `;
  ok(ext.length === 1, "pg_trgm 확장이 설치돼 있다");

  // ── 로케일. LC_CTYPE=C 면 한글이 문자로 안 잡혀 트라이그램이 안 만들어진다.
  // initdb 시점에만 정해져서 나중에 고치려면 데이터를 옮겨야 한다
  const [{ ctype }] = await prisma.$queryRaw<{ ctype: string }[]>`
    SELECT datctype AS ctype FROM pg_database WHERE datname = current_database()
  `;
  ok(!/^(C|POSIX)$/.test(ctype), `LC_CTYPE 가 C 가 아니다 (${ctype})`);

  // 로케일이 살아 있다는 것을 값으로도 본다. C 로케일에서는 이 값이 0 이 된다
  const [{ sim }] = await prisma.$queryRaw<{ sim: number }[]>`
    SELECT similarity('테라로사', '테라로자') AS sim
  `;
  ok(sim > 0, `한글 트라이그램이 만들어진다 (similarity=${sim.toFixed(3)})`);

  // ── GIN 트라이그램 인덱스가 실재하는가
  for (const { table, column, why } of INDEXED) {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = ${table} AND indexdef ILIKE ${"%gin%" + column + "%gin_trgm_ops%"}
    `;
    ok(rows.length > 0, `${table}.${column} 에 GIN 인덱스가 있다 — ${why}`);
  }

  // ── 있기만 한 게 아니라 쿼리가 실제로 탈 수 있는가.
  // 행이 적으면 옵티마이저가 seq scan 을 고르는 게 맞으므로 끄고 본다 —
  // 여기서 보려는 것은 "쓸 수 있는가"이지 "지금 쓰는가"가 아니다.
  // SET LOCAL 이라 트랜잭션이 끝나면 되돌아간다
  const explain = (where: string) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      const rows = await tx.$queryRawUnsafe<Record<string, string>[]>(
        `EXPLAIN SELECT id FROM "Vendor" WHERE ${where}`,
      );
      return rows.map((r) => Object.values(r).join(" ")).join("\n");
    });

  const uses = (plan: string) => plan.includes('Vendor_normalizedName_idx');

  ok(uses(await explain(`"normalizedName" LIKE '테라%'`)), "앞 일치가 인덱스를 탄다");
  ok(uses(await explain(`"normalizedName" % '테라'`)), "오타 허용(%)이 인덱스를 탄다");
  ok(
    uses(await explain(`"normalizedName" LIKE '테라%' OR "normalizedName" % '테라'`)),
    "실제 검색 쿼리 형태가 인덱스를 탄다",
  );

  // GIN 은 **연산자만** 가속한다. `%` 를 `similarity(col, q) > x` 로 바꾸면 함수 호출이라
  // 인덱스가 붙을 자리가 없어진다 — 임계값을 올리려다 인덱스를 통째로 잃는 함정이다.
  // 이 검사가 뒤집히면 Postgres 가 그걸 지원하기 시작한 것이니 그때 다시 판단한다
  ok(
    !uses(await explain(`similarity("normalizedName", '테라') > 0.4`)),
    "similarity() 함수 형태는 인덱스를 못 탄다 — % 를 함수로 바꾸지 말 것",
  );

  // ── 앞 일치를 LIKE 가 담당한다는 주장. 이게 무너지면 `%` 의 기본 임계값(0.3)에
  // 기대게 되는데, similarity('테라로사','테라') = 0.333 이라 여유가 거의 없다
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM (SELECT 1 WHERE '테라로사' LIKE '테라' || '%') t
  `;
  ok(Number(n) === 1, "부분 일치는 similarity 가 아니라 LIKE 가 잡는다");

  ok(MIN_QUERY_LENGTH >= 2, `검색 최소 길이가 2 이상이다 (${MIN_QUERY_LENGTH})`);

  if (failed > 0) {
    console.error(`\n${failed}건 실패`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
