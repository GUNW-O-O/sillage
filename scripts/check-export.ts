// 내보내기 (요구 FR-8) — **DB 층이 볼 것은 하나다: 뽑은 파일이 DB 와 같은가.**
//
// 명단이 스키마와 맞는지는 `src/lib/export.test.ts` 가 본다(순수 함수 층, dmmf 대조).
// 여기서는 그 명단대로 **실제로 행이 다 나왔는지**를 본다 — 쿼리에 where 가 잘못 붙거나
// 정렬 옵션이 컬럼을 못 찾아 조용히 적게 나오는 자리는 DB 를 붙여야만 보인다.
//
// 그리고 **JSON 으로 왕복이 되는지**를 본다. 직렬화가 안 되는 타입이 컬럼에 들어오면
// (Decimal · Bytes · BigInt) 백업 파일이 통째로 못 만들어지는데, 그건 타입 검사도
// 순수 함수 검사도 못 본다 — 실제 행이 있어야 드러난다.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import {
  buildExport,
  EXCLUDED_MODELS,
  EXPORTED_MODELS,
  SCHEMA_VERSION,
} from "../src/lib/export";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

let failed = 0;
const ok = (cond: boolean, label: string) => {
  if (!cond) failed += 1;
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
};

/// 모델 이름("SellerNote") → Prisma 클라이언트의 속성 이름("sellerNote")
const asProperty = (model: string) => model[0].toLowerCase() + model.slice(1);

async function main() {
  const payload = await buildExport(prisma);

  ok(payload.schemaVersion === SCHEMA_VERSION, "schemaVersion 이 봉투에 실린다");
  ok(Number.isInteger(payload.schemaVersion), "schemaVersion 이 정수다");
  ok(!Number.isNaN(Date.parse(payload.exportedAt)), "exportedAt 이 파싱되는 시각이다");
  ok(/^[0-9]+\.[0-9]+\.[0-9]+$/.test(payload.appVersion), "appVersion 이 package.json 값이다");

  // **행 수를 테이블마다 대조한다.** 하나라도 적게 나오면 그 테이블은 복원이 안 된다
  const mismatched: string[] = [];
  for (const model of EXPORTED_MODELS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await (prisma as any)[asProperty(model)].count();
    if (payload.data[model].length !== count) {
      mismatched.push(`${model} (${payload.data[model].length} ≠ ${count})`);
    }
  }
  ok(mismatched.length === 0, `모든 테이블의 행 수가 DB 와 같다 ${mismatched.join(", ")}`);

  // 일부러 뺀 것이 정말 안 들어갔다. 명단만 보면 통과하는 것을 실제 봉투로 확인한다
  ok(
    EXCLUDED_MODELS.every((m) => !(m in payload.data)),
    "일부러 뺀 모델이 봉투에 없다",
  );

  // **왕복이 되는가.** 직렬화가 안 되는 값이 하나만 있어도 백업이 통째로 못 만들어진다
  let roundTrip = false;
  let sameRowCounts = false;
  try {
    const parsed = JSON.parse(JSON.stringify(payload)) as typeof payload;
    roundTrip = true;
    sameRowCounts = EXPORTED_MODELS.every(
      (m) => parsed.data[m].length === payload.data[m].length,
    );
  } catch {
    // roundTrip 이 false 로 남는다
  }
  ok(roundTrip, "JSON 으로 직렬화된다");
  ok(sameRowCounts, "왕복해도 행 수가 그대로다");

  // 시드가 있으므로 빈 백업이 나올 리 없다. 0건이면 연결이나 쿼리가 잘못된 것이다
  const total = EXPORTED_MODELS.reduce((n, m) => n + payload.data[m].length, 0);
  ok(total > 0, `비어 있지 않다 (${total}행)`);

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
