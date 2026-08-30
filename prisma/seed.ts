import { PrismaPg } from "@prisma/adapter-pg";
import { LookupKind, LookupStatus, PrismaClient, Role } from "@prisma/client";
import "dotenv/config";

import { normalizeName } from "../src/lib/normalize";
import { COUNTRY_CODES, FLAVOR_NODES, PROCESSES, VARIETIES, type LookupSeed } from "./seed-data";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL 이 없다");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// 재실행해도 어드민이 고친 값을 덮지 않는다 — update 를 비운다 (설계 9장).
// 목록에 새로 추가된 것만 들어간다.
const CREATE_ONLY = {} as const;

async function seedFlavorNodes() {
  let created = 0;
  for (const l1 of FLAVOR_NODES) {
    await prisma.flavorNode.upsert({
      where: { id: l1.id },
      update: CREATE_ONLY,
      create: { id: l1.id, level: 1, labelKo: l1.labelKo, labelEn: l1.labelEn },
    });
    created += 1;
    for (const l2 of l1.children ?? []) {
      await prisma.flavorNode.upsert({
        where: { id: l2.id },
        update: CREATE_ONLY,
        create: { id: l2.id, level: 2, parentId: l1.id, labelKo: l2.labelKo, labelEn: l2.labelEn },
      });
      created += 1;
    }
  }
  return created;
}

async function seedLookups(kind: LookupKind, rows: LookupSeed[]) {
  for (const row of rows) {
    const normalized = normalizeName(row.nameKo);
    await prisma.lookupValue.upsert({
      where: { kind_normalizedName: { kind, normalizedName: normalized } },
      update: CREATE_ONLY,
      create: {
        kind,
        nameKo: row.nameKo,
        nameEn: row.nameEn,
        normalizedName: normalized,
        aliases: row.aliases ?? [],
        // 시드는 승인된 값이다. PENDING 은 사용자가 인라인 추가한 것에만 붙는다
        status: LookupStatus.APPROVED,
      },
    });
  }
  return rows.length;
}

async function seedCountries() {
  // 249개를 손으로 옮기면 오탈자가 확실히 난다. ICU 에서 뽑는다
  const ko = new Intl.DisplayNames(["ko"], { type: "region" });
  const en = new Intl.DisplayNames(["en"], { type: "region" });

  for (const code of COUNTRY_CODES) {
    const nameKo = ko.of(code) ?? code;
    await prisma.lookupValue.upsert({
      where: { kind_normalizedName: { kind: LookupKind.COUNTRY, normalizedName: normalizeName(nameKo) } },
      update: CREATE_ONLY,
      create: {
        kind: LookupKind.COUNTRY,
        code,
        nameKo,
        nameEn: en.of(code) ?? code,
        normalizedName: normalizeName(nameKo),
        status: LookupStatus.APPROVED,
      },
    });
  }
  return COUNTRY_CODES.length;
}

async function seedAdminUser() {
  // 혼자 쓰는 동안의 계정. 초대 코드 화면은 배포 시점이다 (요구 FR-10)
  const id = "seed-admin";
  await prisma.user.upsert({
    where: { id },
    update: CREATE_ONLY,
    create: { id, displayName: process.env.SEED_ADMIN_NAME ?? "나", role: Role.ADMIN },
  });
  return id;
}

async function main() {
  const nodes = await seedFlavorNodes();
  const processes = await seedLookups(LookupKind.PROCESS, PROCESSES);
  const varieties = await seedLookups(LookupKind.VARIETY, VARIETIES);
  const countries = await seedCountries();
  const admin = await seedAdminUser();

  console.log(`FlavorNode  ${nodes}`);
  console.log(`process     ${processes}`);
  console.log(`variety     ${varieties}`);
  console.log(`country     ${countries}`);
  console.log(`admin user  ${admin}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
