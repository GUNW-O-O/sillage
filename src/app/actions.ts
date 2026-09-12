"use server";

import {
  AliasScope,
  BrewMethod,
  Category,
  LookupKind,
  LookupStatus,
  NoteHitValue,
  Phase,
  Prisma,
  VendorStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { currentUserId } from "@/lib/auth/identity";
import { clientIp } from "@/lib/auth/client-ip";
import {
  ATTEMPT_LIMIT,
  generateInviteCode,
  INVITE_TTL_MS,
  isLockedOut,
} from "@/lib/auth/invite-code";
import { issueSession } from "@/lib/auth/session";
import { findExistingLookup } from "@/lib/lookup-match";
import { computeNoteSetHash } from "@/lib/note-set-hash";
import { normalizeName } from "@/lib/normalize";
import { MIN_QUERY_LENGTH } from "@/lib/search-tuning";
import { collectLookupIds, describeProduct } from "@/lib/product-display";

/// 화면 갱신이 저장 결과를 뒤집으면 안 된다.
///
/// 여러 액션이 `.then(r => { revalidatePath(...); return r })` 로 캐시를 털고 결과를
/// 그대로 넘기는데, 그 뒤에 `.catch` 가 달려 있다. `revalidatePath` 가 던지면
/// **이미 커밋된 쓰기가 실패로 보고되고** 호출부는 재시도해서 "이미 있는 노트다" 를 만난다.
/// 요청 컨텍스트 밖(검사 스크립트)에서 실제로 그렇게 났다.
///
/// 캐시를 못 텄으면 화면이 한 박자 늦게 갱신될 뿐이다. 삼킨다.
function revalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // 요청 컨텍스트가 없다. 저장은 이미 끝났다
  }
}

export type VendorHit = { id: string; name: string; status: VendorStatus };
export type ProductHit = { id: string; name: string; noteCount: number; hasRecord: boolean };

/// 로스터리 검색 (요구 FR-1).
/// pg_trgm 유사도로 근접 후보를 찾는다 — 표기 흔들림을 흡수하는 검색의 전제다.
/// aliases 배열도 같이 훑는다 (설계 4-2).
export async function searchVendors(query: string): Promise<VendorHit[]> {
  const q = normalizeName(query);
  // 화면도 같은 하한을 지키지만 서버가 다시 본다 — 액션은 그대로 열린 엔드포인트다
  if (q.length < MIN_QUERY_LENGTH) return [];

  // `LIKE 'q%'` 가 앞 일치를, `%` 가 오타를 맡는다. **둘 다 GIN 트라이그램 인덱스를 탄다**
  // (Bitmap Index Scan 두 번 + BitmapOr) — scripts/check-search.ts 가 확인한다.
  //
  // `%` 를 `similarity(col, q) > 0.4` 로 바꾸지 말 것. GIN 은 연산자만 가속하고
  // 함수 호출은 못 붙어서, 임계값을 올리려다 인덱스를 통째로 잃는다 (실측: Seq Scan).
  // 임계값을 정말 올려야 하면 `SET LOCAL pg_trgm.similarity_threshold` 를 트랜잭션 안에서
  // 건다. 단 타자마다 도는 검색이 트랜잭션이 되어 왕복이 는다 — 지금은 2글자 하한이
  // 후보 폭발을 막고 있어 필요가 없다.
  return prisma.$queryRaw<VendorHit[]>`
    SELECT id, name, status
    FROM "Vendor"
    WHERE "normalizedName" LIKE ${q + "%"}
       OR "normalizedName" % ${q}
       OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE a ILIKE ${"%" + query.trim() + "%"})
    ORDER BY
      ("normalizedName" LIKE ${q + "%"}) DESC,
      similarity("normalizedName", ${q}) DESC
    LIMIT 8
  `;
}

/// DB 에 없으면 그 자리에서 추가한다. 기록이 막히면 그날의 기록이 사라진다 (설계 4-8).
/// 초기 상태는 pending — 등록자 본인에게는 즉시 보인다.
export async function createVendor(name: string): Promise<VendorHit> {
  const trimmed = name.trim();
  const normalizedName = normalizeName(trimmed);
  if (normalizedName.length === 0) throw new Error("이름이 비어 있다");

  const vendor = await prisma.vendor.upsert({
    where: { normalizedName },
    update: {},
    create: {
      name: trimmed,
      normalizedName,
      status: VendorStatus.PENDING,
      createdById: await currentUserId(),
    },
    select: { id: true, name: true, status: true },
  });
  return vendor;
}

/// 선택한 로스터리 안에서 원두를 찾는다 (요구 FR-2).
/// 이미 내 기록이 붙어 있으면 표시한다 — 다시 고르면 새 기록이 아니라 편집으로 간다 (FR-6).
export async function searchProducts(vendorId: string, query: string): Promise<ProductHit[]> {
  const userId = await currentUserId();
  const q = normalizeName(query);

  const products = await prisma.product.findMany({
    where: {
      vendorId,
      ...(q.length > 0 ? { normalizedName: { contains: q } } : {}),
    },
    select: {
      id: true,
      name: true,
      _count: { select: { sellerNotes: true } },
      experiences: { where: { userId }, select: { id: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    noteCount: p._count.sellerNotes,
    hasRecord: p.experiences.length > 0,
  }));
}

export type ProductGlobalHit = ProductHit & { vendorName: string };

/// 로스터리를 안 고르고 원두 이름으로 바로 찾는다.
///
/// **로스터리명을 반드시 같이 준다.** 원두 이름은 전역 유일하지 않다 — 동일성 키가
/// `[vendorId, category, normalizedName, noteSetHash]` 라 같은 이름이 로스터리마다 있고,
/// 같은 로스터리 안에서도 노트 집합이 다르면 같은 이름이 둘 설 수 있다.
///
/// `searchProducts` 와 나눠 둔다. 저쪽은 `vendorId` 로 이미 좁혀져 있어 `contains` 로 충분하고
/// 빈 질의에 그 로스터리 원두를 전부 보여주는 동작이 있다. 전역은 둘 다 성립하지 않는다.
export async function searchProductsGlobal(query: string): Promise<ProductGlobalHit[]> {
  const q = normalizeName(query);
  if (q.length < MIN_QUERY_LENGTH) return [];
  const userId = await currentUserId();

  // `LIKE 'q%'` 와 `%` 둘 다 Product_normalizedName_idx 를 탄다.
  // `contains`(= LIKE '%q%')를 안 쓰는 이유는 앞 일치에 우선순위를 줘야 하기 때문이다 —
  // 전역에서는 후보가 많아 정렬이 곧 결과다
  return prisma.$queryRaw<ProductGlobalHit[]>`
    SELECT
      p.id,
      p.name,
      v.name AS "vendorName",
      (SELECT count(*) FROM "SellerNote" sn WHERE sn."productId" = p.id)::int AS "noteCount",
      EXISTS (
        SELECT 1 FROM "Experience" e WHERE e."productId" = p.id AND e."userId" = ${userId}
      ) AS "hasRecord"
    FROM "Product" p
    JOIN "Vendor" v ON v.id = p."vendorId"
    WHERE p."normalizedName" LIKE ${q + "%"}
       OR p."normalizedName" % ${q}
    ORDER BY
      (p."normalizedName" LIKE ${q + "%"}) DESC,
      similarity(p."normalizedName", ${q}) DESC
    LIMIT 8
  `;
}

/// 등록 폼의 접힌 상세에 쓰는 lookup. 승인된 것과 내가 추가한 pending 이 같이 보인다.
export async function listApprovedLookups(kind: "COUNTRY" | "VARIETY" | "PROCESS") {
  return prisma.lookupValue.findMany({
    where: { kind, status: LookupStatus.APPROVED },
    select: { id: true, nameKo: true },
    orderBy: { nameKo: "asc" },
  });
}

export type NoteSuggestion = { raw: string; nodeId: string; path: string };

/// `꽃 · 차 > 화이트 플로럴`. 계층이 두 단이라 부모 한 번만 보면 된다 (설계 2026-09-08 §3)
const nodePath = (n: { labelKo: string; parent: { labelKo: string } | null }) =>
  n.parent ? `${n.parent.labelKo} > ${n.labelKo}` : n.labelKo;

/// 노트 자동완성 (설계 7-1 — 노트 입력이 유일한 진짜 병목이다).
/// 이미 등록된 raw 표현과 노드 라벨을 함께 제안한다. NoteAlias 가 자랄수록
/// 타이핑이 줄어 노트 입력도 탭에 수렴한다.
export async function searchNoteSuggestions(query: string): Promise<NoteSuggestion[]> {
  const q = query.trim();
  // NoteAlias 는 표현이 쌓이는 만큼 무한히 늘고 이 검색은 전역이다.
  // `searchProducts` 와 달리 후보를 먼저 좁혀줄 축이 없어 하한이 필요하다
  if (q.length < MIN_QUERY_LENGTH) return [];

  const [aliases, nodes] = await Promise.all([
    prisma.noteAlias.findMany({
      where: { normalizedRaw: { contains: normalizeName(q) } },
      select: {
        raw: true,
        nodeId: true,
        node: { select: { labelKo: true, parent: { select: { labelKo: true } } } },
      },
      orderBy: { usageCount: "desc" },
      take: 6,
    }),
    // 레벨을 가리지 않는다. 총칭 표현(`플로럴` · `초콜릿`)은 어떤 향의 이름이 아니라
    // 카테고리 이름 자체라 L1 에 직접 붙어야 한다 (설계 2026-09-08 §4).
    // 대신 경로를 함께 보여준다 — 안 그러면 큰 갈래와 세부가 한 목록에서 구별이 안 된다
    prisma.flavorNode.findMany({
      where: { OR: [{ labelKo: { contains: q } }, { labelEn: { contains: q, mode: "insensitive" } }] },
      select: { id: true, labelKo: true, parent: { select: { labelKo: true } } },
      // 세부가 먼저다. 순서를 안 주면 take 가 무엇을 자를지 결정적이지 않다
      orderBy: [{ level: "desc" }, { labelKo: "asc" }],
      take: 6,
    }),
  ]);

  const seen = new Set<string>();
  const out: NoteSuggestion[] = [];
  for (const a of aliases) {
    if (seen.has(a.raw)) continue;
    seen.add(a.raw);
    out.push({ raw: a.raw, nodeId: a.nodeId, path: nodePath(a.node) });
  }
  for (const n of nodes) {
    if (seen.has(n.labelKo)) continue;
    seen.add(n.labelKo);
    out.push({ raw: n.labelKo, nodeId: n.id, path: nodePath(n) });
  }
  return out.slice(0, 8);
}

/// **`nameEn` 을 같이 내린다.** 「Geisha」를 쳤는데 목록에 「게이샤」만 뜨면 그것이
/// 내가 찾던 것인지 알 수 없어 옆의 「추가」를 누르게 된다 — 중복이 그렇게 생겼다.
/// 화면은 검색 결과에서만 둘을 나란히 보여준다 (고른 뒤의 칩은 한글만, 폰 폭 때문이다)
export type LookupOption = {
  id: string;
  nameKo: string;
  nameEn: string | null;
  status: LookupStatus;
};

/// sortWeight 가 큰 것부터. 커피 산지를 목록 위로 올리는 자리다 (설계 4-8).

/// 이미 고른 lookup 의 이름을 id 로 되읽는다.
///
/// 수정 화면은 선택된 id 를 들고 시작하는데 `searchLookups` 로는 그 이름을 못 얻는다 —
/// 질의가 비면 상위 60개만 오고 거기 없으면 화면에서 통째로 사라진 것처럼 보인다.
export async function getLookupsByIds(ids: string[]): Promise<LookupOption[]> {
  if (ids.length === 0) return [];
  return prisma.lookupValue.findMany({
    where: { id: { in: ids } },
    select: { id: true, nameKo: true, nameEn: true, status: true },
  });
}

export async function searchLookups(
  kind: "COUNTRY" | "VARIETY" | "PROCESS",
  query: string,
): Promise<LookupOption[]> {
  const q = query.trim();
  return prisma.lookupValue.findMany({
    where: {
      kind,
      ...(q
        ? {
            OR: [
              { normalizedName: { contains: normalizeName(q) } },
              { aliases: { has: q } },
              { nameEn: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, nameKo: true, nameEn: true, status: true },
    orderBy: [{ sortWeight: "desc" }, { status: "asc" }, { nameKo: "asc" }],
    take: q ? 12 : 60,
  });
}

/// lookup 에 값이 없다는 이유로 기록이 막히면 안 된다 (설계 4-8).
/// country 는 닫힌 집합이라 막는다.
///
/// **이미 있는 것을 다른 표기로 다시 만들지 않는다.** `@@unique([kind, normalizedName])` 은
/// `nameKo` 에서 나온 값 하나만 보므로 "게이샤" 가 있어도 "Geisha" 가 그냥 들어온다 —
/// 실제로 `워시드`(nameEn: Washed) 옆에 `Washed` 가 따로 앉아 있었다.
/// 영문 이름과 별칭까지 접어서 대조하고, 맞으면 **만들지 않고 그 행을 돌려준다**
/// (`lookup-match.ts`).
///
/// **화면의 「추가」 버튼을 감추는 것으로는 안 막힌다** — 서버 액션은 경로만 알면
/// 요청이 들어오는 공개 엔드포인트다 (설계 4-1 과 같은 이유).
export async function createLookup(
  kind: "VARIETY" | "PROCESS",
  nameKo: string,
): Promise<LookupOption> {
  const trimmed = nameKo.trim();
  const normalizedName = normalizeName(trimmed);
  if (!normalizedName) throw new Error("이름이 비어 있다");

  // 같은 kind 를 통째로 읽는다. 품종 40 · 가공 20 개고 인라인 추가는 드문 조작이라 싸다
  const rows = await prisma.lookupValue.findMany({
    where: { kind },
    select: { id: true, nameKo: true, nameEn: true, aliases: true, status: true },
  });
  const existing = findExistingLookup(rows, trimmed);
  if (existing) {
    const { id, nameKo: ko, nameEn, status } = existing;
    return { id, nameKo: ko, nameEn, status };
  }

  // upsert 를 남겨 둔다. 위 대조와 이 쓰기 사이에 남이 **같은 표기로** 넣을 수 있는데,
  // 그 경우는 normalizedName 이 같으므로 DB 가 막고 기존 행이 돌아온다
  return prisma.lookupValue.upsert({
    where: { kind_normalizedName: { kind, normalizedName } },
    update: {},
    create: {
      kind,
      nameKo: trimmed,
      normalizedName,
      status: LookupStatus.PENDING,
      createdById: await currentUserId(),
    },
    select: { id: true, nameKo: true, nameEn: true, status: true },
  });
}

export type NoteInput = { raw: string; nodeId: string | null };

export type CreateProductInput = {
  vendorId: string;
  name: string;
  notes: NoteInput[];
  attributes: Record<string, unknown>;
};

export type CreateProductResult =
  | { ok: true; productId: string }
  | { ok: false; reason: "duplicate"; productId: string; productName: string }
  | { ok: false; reason: "invalid"; message: string };

/// 원두 등록 (요구 FR-3).
///
/// 필수는 셋뿐이다 — 로스터리 · 제품명 · 노트 1개 이상. 나머지는 전부 nullable 이다.
/// 로스터리마다 공개 수준이 천차만별이라 채우기를 강제하면 등록이 막힌다 (설계 4-3).
export async function createProduct(input: CreateProductInput): Promise<CreateProductResult> {
  const name = input.name.trim();
  const normalizedName = normalizeName(name);
  const notes = input.notes
    .map((n) => ({ raw: n.raw.trim(), nodeId: n.nodeId }))
    .filter((n) => n.raw.length > 0);

  if (!normalizedName) return { ok: false, reason: "invalid", message: "제품명을 적어 주세요" };
  // 노트가 없으면 대조할 것이 없어 엔진 입력이 0이다 (설계 4-3)
  if (notes.length === 0) return { ok: false, reason: "invalid", message: "판매자 노트가 최소 1개 필요해요" };

  const noteSetHash = computeNoteSetHash(notes);

  // 같은 로스터리 · 같은 제품명 · 같은 노트 집합이면 같은 원두다.
  // unique 제약이 차단하므로 미리 찾아 기존 것으로 유도한다 (설계 4-3).
  const existing = await prisma.product.findUnique({
    where: {
      vendorId_category_normalizedName_noteSetHash: {
        vendorId: input.vendorId,
        category: Category.COFFEE,
        normalizedName,
        noteSetHash,
      },
    },
    select: { id: true, name: true },
  });
  if (existing) {
    return { ok: false, reason: "duplicate", productId: existing.id, productName: existing.name };
  }

  const product = await prisma.product.create({
    data: {
      vendorId: input.vendorId,
      category: Category.COFFEE,
      name,
      normalizedName,
      noteSetHash,
      attributes: input.attributes as Prisma.InputJsonValue,
      createdById: await currentUserId(),
      sellerNotes: {
        create: notes.map((n, i) => ({ raw: n.raw, nodeId: n.nodeId, position: i })),
      },
    },
    select: { id: true },
  });

  // 매핑 실패는 사전이 어디서 막히는지의 유일한 기록이다 (요구 4장). 로그 한 줄
  for (const n of notes) {
    if (n.nodeId === null) {
      console.info(`[note-unmapped] raw=${JSON.stringify(n.raw)} product=${product.id}`);
    }
  }

  return { ok: true, productId: product.id };
}

export type NoteHitValueInput = "MISS" | "UNSURE" | "WEAK" | "STRONG";

/// 기록 저장 (요구 FR-6).
///
/// Product 당 Experience 는 1개다 (설계 4-4). 같은 원두를 다시 골라도 새로 만들지 않고
/// 기존 기록을 고친다. 그래서 라우트가 /products/[id]/record 하나다.
///
/// 저장에 제약을 두지 않는다 — 안 찍힌 노트가 "못 느껴서"인지 "귀찮아서"인지
/// 시스템이 구분할 수 없고, 구분 못 하는 것으로 막을 수 없다.
export async function saveRecord(
  productId: string,
  hits: { sellerNoteId: string; value: NoteHitValueInput }[],
  /// 판매자가 안 적었는데 내가 느낀 향 (설계 4-4 `ExtraNote`).
  /// 판정값이 없다 — 판매자의 주장이 없으니 대조할 좌변이 없고, 적었다는 사실 자체가 값이다
  extraNotes: NoteInput[] = [],
): Promise<{ ok: true }> {
  const userId = await currentUserId();

  await prisma.$transaction(async (tx) => {
    const experience = await tx.experience.upsert({
      where: {
        userId_productId_method_phase: {
          userId,
          productId,
          method: BrewMethod.HAND_DRIP,
          phase: Phase.OVERALL,
        },
      },
      update: {},
      create: {
        userId,
        productId,
        method: BrewMethod.HAND_DRIP,
        phase: Phase.OVERALL,
      },
      select: { id: true },
    });

    // 노트 항목 단위 행으로 저장한다. JSON blob 이면 나중에 노트가 추가·삭제될 때
    // 부분 보존이 원리적으로 불가능해진다 (설계 4-4)
    for (const hit of hits) {
      await tx.noteHit.upsert({
        where: {
          experienceId_sellerNoteId: { experienceId: experience.id, sellerNoteId: hit.sellerNoteId },
        },
        update: { value: hit.value as NoteHitValue },
        create: {
          experienceId: experience.id,
          sellerNoteId: hit.sellerNoteId,
          value: hit.value as NoteHitValue,
        },
      });
    }

    // 판매자 노트와 달리 통째로 갈아끼운다. noteHits 는 판정이 붙어 있어 부분 보존이
    // 필요하지만(설계 4-4) ExtraNote 에는 붙는 것이 없다 — 지운 것은 안 느낀 것이다.
    // 개수가 적어 교체 비용도 무시할 만하다
    await tx.extraNote.deleteMany({ where: { experienceId: experience.id } });
    if (extraNotes.length > 0) {
      await tx.extraNote.createMany({
        data: extraNotes.map((n) => ({
          experienceId: experience.id,
          raw: n.raw,
          // 자동완성에 없는 표현이면 null 로 남는다. **raw 는 절대 버리지 않는다** —
          // 로스터리 간 표현 비교의 유일한 근거다 (요구 4장).
          // 축이 안 붙은 것은 집계에 안 들어가고 어드민 미매핑 큐에서 붙인다
          nodeId: n.nodeId,
        })),
      });
    }
  });

  revalidate("/");
  return { ok: true };
}

export async function deleteRecord(productId: string): Promise<{ ok: true }> {
  await prisma.experience.deleteMany({ where: { userId: await currentUserId(), productId } });
  revalidate("/");
  return { ok: true };
}

// ─────────────────────────────────────────── 어드민 (요구 FR-9)

/// noteSetHash 는 파생값이라 언제든 재계산 가능해야 한다 (설계 4-3).
/// 미매핑 raw 를 붙이거나 지우면 여기서 다시 계산되고, 그 결과 다른 Product 과
/// 키가 같아질 수 있다 — 그건 병합 대상이라 적용하지 않고 알린다 (설계 7-4).
async function recomputeHash(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<{ ok: true } | { ok: false; conflictWith: string; conflictName: string }> {
  const product = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    select: {
      vendorId: true,
      category: true,
      normalizedName: true,
      sellerNotes: { select: { raw: true, nodeId: true } },
    },
  });
  const noteSetHash = computeNoteSetHash(product.sellerNotes);

  const clash = await tx.product.findUnique({
    where: {
      vendorId_category_normalizedName_noteSetHash: {
        vendorId: product.vendorId,
        category: product.category,
        normalizedName: product.normalizedName,
        noteSetHash,
      },
    },
    select: { id: true, name: true },
  });
  if (clash && clash.id !== productId) {
    return { ok: false, conflictWith: clash.id, conflictName: clash.name };
  }

  await tx.product.update({ where: { id: productId }, data: { noteSetHash } });
  return { ok: true };
}

// ─────────────────────────────────────────── 노트 추가 제안 (요구 FR-9)

export type NoteProposal = {
  raw: string;
  normalizedRaw: string;
  nodeId: string | null;
  nodeLabel: string | null;
  /// 같은 표현을 낸 사람 수. **이것이 동의 수다** — 별도 동의 테이블을 두지 않는다
  agreeCount: number;
  /// 내가 이미 냈는가. 냈으면 다시 못 내고 철회만 된다
  mine: boolean;
};

/// 노트를 하나 제안한다. 누구나 할 수 있다.
///
/// 이미 그 원두의 노트로 있으면 거절한다 — 제안할 것이 없다.
/// 이미 내가 낸 것이면 조용히 성공으로 둔다. 두 번 눌렀을 때 오류를 띄울 이유가 없다.
export async function proposeSellerNote(
  productId: string,
  raw: string,
  nodeId: string | null,
): Promise<AdminResult> {
  const trimmed = raw.trim();
  const normalizedRaw = normalizeName(trimmed);
  if (!normalizedRaw) return { ok: false, message: "노트가 비어 있어요" };

  const exists = await prisma.sellerNote.findFirst({
    where: { productId, raw: trimmed },
    select: { id: true },
  });
  if (exists) return { ok: false, message: "이미 이 원두의 노트예요" };

  const createdById = await currentUserId();
  await prisma.sellerNoteProposal.upsert({
    where: { productId_normalizedRaw_createdById: { productId, normalizedRaw, createdById } },
    // 두 번째 제안은 아무것도 안 바꾼다. raw 를 덮으면 먼저 낸 사람의 표기가 바뀐다
    update: {},
    create: { productId, raw: trimmed, normalizedRaw, nodeId, createdById },
  });
  revalidate("/");
  return { ok: true };
}

/// 낸 제안을 거둔다. 동의 1이 빠진다
export async function withdrawNoteProposal(
  productId: string,
  normalizedRaw: string,
): Promise<AdminResult> {
  await prisma.sellerNoteProposal.deleteMany({
    where: { productId, normalizedRaw, createdById: await currentUserId() },
  });
  revalidate("/");
  return { ok: true };
}

/// 원두 화면이 쓴다. 표현 단위로 묶어 동의 수를 센다
export async function listProductProposals(productId: string): Promise<NoteProposal[]> {
  const userId = await currentUserId();
  const rows = await prisma.sellerNoteProposal.findMany({
    where: { productId },
    select: {
      raw: true,
      normalizedRaw: true,
      nodeId: true,
      createdById: true,
      node: { select: { labelKo: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const byKey = new Map<string, NoteProposal>();
  for (const r of rows) {
    const cur = byKey.get(r.normalizedRaw);
    if (cur) {
      cur.agreeCount += 1;
      cur.mine ||= r.createdById === userId;
      // 축은 붙은 것이 하나라도 있으면 그것을 쓴다
      if (!cur.nodeId && r.nodeId) {
        cur.nodeId = r.nodeId;
        cur.nodeLabel = r.node?.labelKo ?? null;
      }
      continue;
    }
    byKey.set(r.normalizedRaw, {
      // 표시는 **먼저 낸 사람의 표기**를 쓴다. 나중 사람이 덮으면 남의 화면 글자가 바뀐다
      raw: r.raw,
      normalizedRaw: r.normalizedRaw,
      nodeId: r.nodeId,
      nodeLabel: r.node?.labelKo ?? null,
      agreeCount: 1,
      mine: r.createdById === userId,
    });
  }
  return [...byKey.values()].sort((a, b) => b.agreeCount - a.agreeCount);
}

export type AdminNoteProposal = NoteProposal & {
  productId: string;
  productName: string;
  vendorName: string;
};

/// 어드민 큐. 처리할 것이 많이 몰린 것부터 본다
export async function listNoteProposals(): Promise<AdminNoteProposal[]> {
  await requireAdmin();
  const rows = await prisma.sellerNoteProposal.findMany({
    select: {
      raw: true,
      normalizedRaw: true,
      nodeId: true,
      createdById: true,
      productId: true,
      node: { select: { labelKo: true } },
      product: { select: { name: true, vendor: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const byKey = new Map<string, AdminNoteProposal>();
  for (const r of rows) {
    const key = `${r.productId}:${r.normalizedRaw}`;
    const cur = byKey.get(key);
    if (cur) {
      cur.agreeCount += 1;
      if (!cur.nodeId && r.nodeId) {
        cur.nodeId = r.nodeId;
        cur.nodeLabel = r.node?.labelKo ?? null;
      }
      continue;
    }
    byKey.set(key, {
      raw: r.raw,
      normalizedRaw: r.normalizedRaw,
      nodeId: r.nodeId,
      nodeLabel: r.node?.labelKo ?? null,
      agreeCount: 1,
      mine: false,
      productId: r.productId,
      productName: r.product.name,
      vendorName: r.product.vendor.name,
    });
  }
  return [...byKey.values()].sort((a, b) => b.agreeCount - a.agreeCount);
}

/// 제안을 실제 노트로 올린다. 어드민만.
///
/// **키 충돌로 막힐 수 있다.** 노트가 늘면 noteSetHash 가 바뀌고 그 결과가 다른 원두와
/// 같아지면 적용이 안 된다 — 그때는 제안을 큐에 남긴다. 지우면 판단 근거가 사라진다
export async function approveNoteProposal(
  productId: string,
  normalizedRaw: string,
): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  return prisma
    .$transaction(async (tx) => {
      const proposals = await tx.sellerNoteProposal.findMany({
        where: { productId, normalizedRaw },
        select: { raw: true, nodeId: true },
        orderBy: { createdAt: "asc" },
      });
      if (proposals.length === 0) throw new Error("이미 처리된 제안이다");

      const raw = proposals[0].raw;
      const nodeId = proposals.find((p) => p.nodeId)?.nodeId ?? null;

      const dup = await tx.sellerNote.findFirst({ where: { productId, raw }, select: { id: true } });
      if (dup) throw new Error("이미 있는 노트다");

      const last = await tx.sellerNote.findFirst({
        where: { productId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      await tx.sellerNote.create({
        data: { productId, raw, nodeId, position: (last?.position ?? -1) + 1 },
      });

      const r = await recomputeHash(tx, productId);
      if (!r.ok) {
        throw new Error(`올리면 「${r.conflictName}」 과 같은 원두가 된다. 병합이 먼저다`);
      }

      await tx.sellerNoteProposal.deleteMany({ where: { productId, normalizedRaw } });
      return { ok: true as const };
    })
    .then((r) => {
      revalidate("/");
      revalidate("/admin");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 제안을 지운다. 향미가 아닌 표현 · 오타 · 중복이 실재한다 —
/// 지우는 수단이 없으면 큐가 영영 안 빈다 (미매핑 큐와 같은 근거)
export async function rejectNoteProposal(
  productId: string,
  normalizedRaw: string,
): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  await prisma.sellerNoteProposal.deleteMany({ where: { productId, normalizedRaw } });
  revalidate("/admin");
  return { ok: true };
}

export type AdminProductNote = {
  id: string;
  raw: string;
  nodeId: string | null;
  nodeLabel: string | null;
  /// 이 노트에 붙은 판정 수. 0 이 아니면 지울 수 없다
  hitCount: number;
};

export type AdminProduct = {
  id: string;
  name: string;
  vendorName: string;
  sampleSize: number;
  notes: AdminProductNote[];
};

/// 어드민의 Product 노트 편집 화면이 쓴다 (요구 FR-9 — 잘못 지운 것 복구 · 빠뜨린 노트 보강).
///
/// `getProductDetail` 을 안 쓴다. 저쪽은 판정 분포를 사람에게 보여주는 것이 목적이라
/// 여기서 필요 없는 집계를 다 돌린다. 여기서 필요한 것은 **지울 수 있는가**뿐이다.
export async function getAdminProduct(productId: string): Promise<AdminProduct | null> {
  await requireAdmin();
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      vendor: { select: { name: true } },
      _count: { select: { experiences: true } },
      sellerNotes: {
        select: {
          id: true,
          raw: true,
          nodeId: true,
          node: { select: { labelKo: true } },
          _count: { select: { noteHits: true } },
        },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    name: p.name,
    vendorName: p.vendor.name,
    sampleSize: p._count.experiences,
    notes: p.sellerNotes.map((n) => ({
      id: n.id,
      raw: n.raw,
      nodeId: n.nodeId,
      nodeLabel: n.node?.labelKo ?? null,
      hitCount: n._count.noteHits,
    })),
  };
}

/// 미매핑 raw 의 출처. 붙이는 것은 같지만 **지우는 규칙이 다르다** —
/// 판매자 노트는 동일성 키의 절반이라 마지막 하나를 못 지우고 해시가 재계산되지만,
/// 내가 느낀 향은 키 밖이라 제약이 없다
export type NoteSource = "SELLER" | "EXTRA";

export type UnmappedNote = {
  id: string;
  raw: string;
  source: NoteSource;
  productId: string;
  productName: string;
  vendorName: string;
  /// 같은 raw 가 몇 군데서 쓰였나. 붙일 가치를 판단하는 근거다
  sameRawCount: number;
};

/// 미매핑 raw 큐 — 어드민의 주 작업 화면이다 (설계 7-4).
/// 등록 폼에서 노트 분류를 뺐으므로 여기가 없으면 noteSetHash 가 전부
/// unmapped 토큰으로 남아 동일성 키가 무의미해진다.
export async function listUnmappedNotes(): Promise<UnmappedNote[]> {
  await requireAdmin();
  // 판매자 노트와 내가 느낀 향을 **한 큐에서** 본다. NoteAlias 는 표현→노드 사전이고
  // 표현이 같으면 노드도 같아야 한다 — 큐를 나누면 같은 raw 를 두 번 판단하게 되고
  // 사전이 갈릴 수 있다
  const [sellerRows, extraRows] = await Promise.all([
    prisma.sellerNote.findMany({
      where: { nodeId: null },
      select: {
        id: true,
        raw: true,
        productId: true,
        product: { select: { name: true, vendor: { select: { name: true } } } },
      },
      orderBy: { addedAt: "asc" },
      take: 200,
    }),
    prisma.extraNote.findMany({
      where: { nodeId: null },
      select: {
        id: true,
        raw: true,
        experience: {
          select: {
            productId: true,
            product: { select: { name: true, vendor: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  const rows: UnmappedNote[] = [
    ...sellerRows.map((r) => ({
      id: r.id,
      raw: r.raw,
      source: "SELLER" as const,
      productId: r.productId,
      productName: r.product.name,
      vendorName: r.product.vendor.name,
      sameRawCount: 0,
    })),
    ...extraRows.map((r) => ({
      id: r.id,
      raw: r.raw,
      source: "EXTRA" as const,
      productId: r.experience.productId,
      productName: r.experience.product.name,
      vendorName: r.experience.product.vendor.name,
      sameRawCount: 0,
    })),
  ];

  // 출처를 가리지 않고 센다. 붙일 가치는 그 표현이 몇 번 나왔느냐로 판단한다
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.raw, (counts.get(r.raw) ?? 0) + 1);
  for (const r of rows) r.sameRawCount = counts.get(r.raw) ?? 1;

  return rows;
}

export type AdminResult = { ok: true } | { ok: false; message: string };

/// raw 를 노드에 붙인다. 같은 raw 를 쓰는 다른 미매핑 항목도 함께 붙는다 —
/// 하나씩 보는 것보다 모아 보는 편이 판단이 정확하다는 것이 이 큐의 전제다.
export async function attachNote(raw: string, nodeId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const normalizedRaw = normalizeName(raw);

  return prisma.$transaction(async (tx) => {
    // 어드민이 붙인 매핑은 공용이다.
    // upsert 를 쓸 수 없다 — public 유일성은 부분 유니크 인덱스로 걸려 있고
    // (createdById 가 NULL 이라 복합 unique 가 동작하지 않는다) Prisma 는 부분 인덱스를
    // where 대상으로 잡지 못한다
    const existing = await tx.noteAlias.findFirst({
      where: { normalizedRaw, scope: AliasScope.PUBLIC },
      select: { id: true },
    });
    if (existing) {
      await tx.noteAlias.update({ where: { id: existing.id }, data: { nodeId } });
    } else {
      await tx.noteAlias.create({
        data: { raw, normalizedRaw, nodeId, scope: AliasScope.PUBLIC },
      });
    }

    const targets = await tx.sellerNote.findMany({
      where: { nodeId: null, raw },
      select: { id: true, productId: true },
    });
    await tx.sellerNote.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { nodeId } });

    // 같은 표현의 `내가 느낀 향` 도 함께 붙는다. 사전이 하나이므로 결과도 하나여야 한다.
    // **해시 재계산은 하지 않는다** — ExtraNote 는 동일성 키 밖이라 붙여도 키가 안 움직인다
    await tx.extraNote.updateMany({ where: { nodeId: null, raw }, data: { nodeId } });

    for (const productId of new Set(targets.map((t) => t.productId))) {
      const r = await recomputeHash(tx, productId);
      if (!r.ok) {
        throw new Error(
          `“${raw}” 를 붙이면 「${r.conflictName}」 과 같은 원두가 된다. 병합이 먼저다`,
        );
      }
    }
    return { ok: true as const };
  }).catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 오타 · 향미가 아닌 표기는 지운다. 행을 그대로 지운다 — 지키지 않을 값을 위해
/// 모든 해시 계산과 대조 쿼리에 제외 조건을 달고 다닐 이유가 없다 (설계 7-4).
export async function deleteNote(sellerNoteId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  return prisma.$transaction(async (tx) => {
    const note = await tx.sellerNote.findUniqueOrThrow({
      where: { id: sellerNoteId },
      select: { productId: true },
    });
    const remaining = await tx.sellerNote.count({ where: { productId: note.productId } });
    // 노트가 없으면 대조할 것이 없어 엔진 입력이 0이다 (설계 4-3)
    if (remaining <= 1) throw new Error("마지막 노트는 지울 수 없다. 원두에 노트가 최소 1개 필요하다");

    await tx.sellerNote.delete({ where: { id: sellerNoteId } });
    const r = await recomputeHash(tx, note.productId);
    if (!r.ok) throw new Error(`지우면 「${r.conflictName}」 과 같은 원두가 된다. 병합이 먼저다`);
    return { ok: true as const };
  }).catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 내가 느낀 향을 큐에서 지운다. 판매자 노트와 달리 제약이 없다 —
/// 동일성 키 밖이라 해시가 안 움직이고, 마지막 하나를 지켜야 할 이유도 없다
/// (판매자 노트가 0개면 대조할 주장이 없어지지만, 이건 부가 항목이다).
export async function deleteExtraNote(extraNoteId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  // `deleteNote` 와 마찬가지로 revalidatePath 를 안 부른다 — 이 항목은 목록 화면에
  // 안 나오고, 큐 화면은 스스로 router.refresh() 한다
  await prisma.extraNote.delete({ where: { id: extraNoteId } });
  return { ok: true };
}

export async function listFlavorTree() {
  await requireAdmin();
  const nodes = await prisma.flavorNode.findMany({
    select: { id: true, level: true, parentId: true, labelKo: true },
    orderBy: [{ level: "asc" }, { labelKo: "asc" }],
  });
  return nodes
    .filter((n) => n.level === 1)
    .map((l1) => ({ ...l1, children: nodes.filter((n) => n.parentId === l1.id) }));
}

export async function adminStats() {
  await requireAdmin();
  const [unmapped, mapped, pendingVendors, pendingLookups, products, vendors, records, proposalRows] =
    await Promise.all([
      // 미매핑은 판매자 노트와 내가 느낀 향 양쪽에서 나온다
      prisma.sellerNote.count({ where: { nodeId: null } }),
      prisma.sellerNote.count({ where: { nodeId: { not: null } } }),
      prisma.vendor.count({ where: { status: VendorStatus.PENDING } }),
      prisma.lookupValue.count({ where: { status: LookupStatus.PENDING } }),
      prisma.product.count(),
      prisma.vendor.count(),
      prisma.experience.count(),
      // 제안은 (원두 · 표현) 단위로 묶여 한 줄이 된다. 행 수를 그대로 세면
      // 동의가 많은 제안 하나가 여러 건으로 보인다
      prisma.sellerNoteProposal.findMany({
        select: { productId: true, normalizedRaw: true },
        distinct: ["productId", "normalizedRaw"],
      }),
    ]);
  return {
    unmapped,
    mapped,
    pendingVendors,
    pendingLookups,
    products,
    vendors,
    records,
    proposals: proposalRows.length,
  };
}

export type PendingVendor = { id: string; name: string; productCount: number };
export type PendingLookup = { id: string; kind: LookupKind; nameKo: string; nameEn: string | null };

export async function listPending() {
  await requireAdmin();
  const [vendors, lookups] = await Promise.all([
    prisma.vendor.findMany({
      where: { status: VendorStatus.PENDING },
      select: { id: true, name: true, _count: { select: { products: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.lookupValue.findMany({
      where: { status: LookupStatus.PENDING },
      select: { id: true, kind: true, nameKo: true, nameEn: true },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  return {
    vendors: vendors.map((v) => ({ id: v.id, name: v.name, productCount: v._count.products })),
    lookups,
  };
}

export async function mergeLookup(sourceId: string, targetId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (sourceId === targetId) return { ok: false, message: "같은 항목이에요" };

  return prisma
    .$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.lookupValue.findUniqueOrThrow({ where: { id: sourceId } }),
        tx.lookupValue.findUniqueOrThrow({ where: { id: targetId } }),
      ]);
      if (source.kind !== target.kind) throw new Error("종류가 다르다");

      await tx.lookupValue.update({
        where: { id: targetId },
        data: {
          aliases: [...new Set([...target.aliases, source.nameKo, ...source.aliases])],
        },
      });

      // attributes JSONB 안의 id 에는 FK 를 걸 수 없다 (설계 4-3).
      // 무결성은 여기서 진다 — 참조를 직접 훑어 갈아끼운다
      const products = await tx.product.findMany({ select: { id: true, attributes: true } });
      for (const p of products) {
        const a = p.attributes as Record<string, unknown>;
        let touched = false;
        for (const key of ["countryId", "processId"]) {
          if (a[key] === sourceId) {
            a[key] = targetId;
            touched = true;
          }
        }
        for (const key of ["countryIds", "processIds", "varietyIds"]) {
          const list = a[key];
          if (Array.isArray(list) && list.includes(sourceId)) {
            a[key] = [...new Set(list.map((v) => (v === sourceId ? targetId : v)))];
            touched = true;
          }
        }
        if (touched) {
          await tx.product.update({
            where: { id: p.id },
            data: { attributes: a as Prisma.InputJsonValue },
          });
        }
      }

      await tx.lookupValue.delete({ where: { id: sourceId } });
      return { ok: true as const };
    })
    .then((r) => {
      revalidate("/admin");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

export async function listLookupsByKind(kind: LookupKind) {
  await requireAdmin();
  return prisma.lookupValue.findMany({
    where: { kind, status: LookupStatus.APPROVED },
    select: { id: true, nameKo: true },
    orderBy: [{ sortWeight: "desc" }, { nameKo: "asc" }],
    take: 300,
  });
}

export async function approveVendorWith(id: string, aliases: string[]): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const clean = [...new Set(aliases.map((a) => a.trim()).filter(Boolean))];
  await prisma.vendor.update({
    where: { id },
    data: { status: VendorStatus.APPROVED, ...(clean.length ? { aliases: clean } : {}) },
  });
  revalidate("/admin");
  return { ok: true };
}

/// 로스터리 병합. Product 동일성 키에 vendorId 가 들어가므로 아래 원두의 키가
/// 전부 움직인다 — 이전 후 대상 아래에서 중복을 다시 검사해야 한다 (설계 7-4).
export async function mergeVendor(sourceId: string, targetId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (sourceId === targetId) return { ok: false, message: "같은 로스터리예요" };

  return prisma
    .$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.vendor.findUniqueOrThrow({
          where: { id: sourceId },
          select: { name: true, aliases: true, products: { select: { id: true, category: true, normalizedName: true, noteSetHash: true } } },
        }),
        tx.vendor.findUniqueOrThrow({ where: { id: targetId }, select: { name: true, aliases: true } }),
      ]);

      // 이전하면 키가 충돌하는 원두가 있는지 먼저 본다. 있으면 Product 병합이 먼저다
      for (const p of source.products) {
        const clash = await tx.product.findUnique({
          where: {
            vendorId_category_normalizedName_noteSetHash: {
              vendorId: targetId,
              category: p.category,
              normalizedName: p.normalizedName,
              noteSetHash: p.noteSetHash,
            },
          },
          select: { name: true },
        });
        if (clash) {
          throw new Error(
            `「${target.name}」 에 같은 원두(${clash.name})가 이미 있다. Product 병합이 먼저다`,
          );
        }
      }

      await tx.product.updateMany({ where: { vendorId: sourceId }, data: { vendorId: targetId } });
      await tx.vendor.update({
        where: { id: targetId },
        data: { aliases: [...new Set([...target.aliases, source.name, ...source.aliases])] },
      });
      await tx.vendor.delete({ where: { id: sourceId } });
      return { ok: true as const };
    })
    .then((r) => {
      revalidate("/admin");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

export async function listApprovedVendors() {
  await requireAdmin();
  const rows = await prisma.vendor.findMany({
    where: { status: VendorStatus.APPROVED },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 300,
  });
  // 흡수 모달이 lookup 과 같은 모양을 쓰므로 키를 맞춘다
  return rows.map((v) => ({ id: v.id, nameKo: v.name }));
}

/// FlavorNode 의 id 는 집계 축이라 한 번 정하면 못 바꾼다 — 바꾸면 데이터 마이그레이션이다.
/// labelEn 에서 뽑되 영문·숫자·밑줄만 남긴다.
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/// Level 2 노드 추가 (설계 7-4).
/// L1 아홉 개는 골격이라 건드리지 않는다. Level 3 도 시드하지 않는다 —
/// 집계 레벨이 L2 라 L3 는 엔진에 쓰이지 않는다 (설계 4-6).
export async function createFlavorNodeL2(
  parentId: string,
  labelKo: string,
  labelEn: string,
): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const ko = labelKo.trim();
  const en = labelEn.trim();
  const id = slugify(en);
  if (!ko || !en) return { ok: false, message: "한글 · 영문 라벨이 둘 다 필요해요" };
  if (!id) return { ok: false, message: "영문 라벨에서 id 를 만들 수 없어요" };

  const parent = await prisma.flavorNode.findUnique({
    where: { id: parentId },
    select: { level: true },
  });
  if (!parent || parent.level !== 1) return { ok: false, message: "부모는 Level 1 이어야 해요" };
  if (await prisma.flavorNode.findUnique({ where: { id }, select: { id: true } })) {
    return { ok: false, message: `id "${id}" 가 이미 있다` };
  }

  await prisma.flavorNode.create({
    data: { id, level: 2, parentId, labelKo: ko, labelEn: en },
  });
  revalidate("/admin");
  return { ok: true };
}

/// 노드의 라벨과 부모를 고친다 (설계 2026-09-08 §7).
/// **id 는 안 바꾼다** — 집계 축이라 바꾸는 순간 데이터 마이그레이션이다.
/// 부모만 옮기는 것은 `nodeId` 가 그대로라 `noteSetHash` 가 안 움직인다 — 소급이 없다.
/// 별칭으로 격하하는 것(`remapAlias`)과 비용이 다르고, 그 차이를 `scripts/check-flavor.ts` 가 지킨다.
export async function updateFlavorNode(
  id: string,
  parentId: string | null,
  labelKo: string,
  labelEn: string,
  /// 빈 문자열이면 색을 지운다 — 부모에서 물려받는 상태로 돌아간다 (설계 2026-09-08 §6).
  /// 되돌릴 수단이 없으면 한 번 잘못 넣은 색을 영영 못 뺀다
  color: string,
): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const ko = labelKo.trim();
  const en = labelEn.trim();
  if (!ko || !en) return { ok: false, message: "한글 · 영문 라벨이 둘 다 필요해요" };

  // 값이 그대로 style 에 들어가므로 형식을 여기서 막는다. 6자리 hex 만 받는다 —
  // 색 이름이나 함수 표기를 허용하면 무엇이 들어왔는지 화면에서 대조할 수가 없다
  const hex = color.trim();
  if (hex && !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return { ok: false, message: "색은 #rrggbb 여섯 자리로 적어요" };
  }

  const node = await prisma.flavorNode.findUnique({ where: { id }, select: { level: true } });
  if (!node) return { ok: false, message: "없는 노드예요" };

  // 레벨을 따로 받지 않는다 — 부모가 없으면 L1, 있으면 L2 로 이미 정해진다.
  // 그리고 그 레벨이 지금과 달라지는 이동은 막는다. L1 은 골격이고(설계 7-4),
  // L2 를 L1 으로 올리면 붙어 있던 별칭이 해상도 없는 축에 앉는다
  if ((parentId ? 2 : 1) !== node.level) {
    return { ok: false, message: "레벨은 못 바꿔요. 라벨과 부모만 고칠 수 있어요" };
  }

  if (parentId) {
    if (parentId === id) return { ok: false, message: "자기 자신을 부모로 둘 수 없어요" };
    const parent = await prisma.flavorNode.findUnique({
      where: { id: parentId },
      select: { level: true },
    });
    // 계층은 두 단이다 (설계 2026-09-08 §3). L2 아래로 옮기면 L3 가 생긴다
    if (!parent || parent.level !== 1) return { ok: false, message: "부모는 Level 1 이어야 해요" };
  }

  await prisma.flavorNode.update({
    where: { id },
    data: { parentId, labelKo: ko, labelEn: en, color: hex || null },
  });
  revalidate("/admin");
  // 띠는 원두 상세와 기록 시트가 그린다. 어드민만 새로 그리면 색이 안 바뀐 것처럼 보인다
  revalidate("/");
  return { ok: true };
}

/// 품종 · 가공을 어드민이 직접 추가한다. 인라인 추가와 달리 바로 승인 상태다.
/// country 는 닫힌 집합이라 막는다 (설계 4-8).
export async function createLookupApproved(
  kind: "VARIETY" | "PROCESS",
  nameKo: string,
  nameEn: string,
  aliases: string[],
): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const ko = nameKo.trim();
  const normalizedName = normalizeName(ko);
  if (!normalizedName) return { ok: false, message: "이름이 비어 있어요" };

  const dup = await prisma.lookupValue.findUnique({
    where: { kind_normalizedName: { kind, normalizedName } },
    select: { nameKo: true },
  });
  if (dup) return { ok: false, message: `「${dup.nameKo}」 와 같은 값이다` };

  await prisma.lookupValue.create({
    data: {
      kind,
      nameKo: ko,
      nameEn: nameEn.trim() || null,
      normalizedName,
      aliases: [...new Set(aliases.map((a) => a.trim()).filter(Boolean))],
      status: LookupStatus.APPROVED,
      createdById: await currentUserId(),
    },
  });
  revalidate("/admin");
  return { ok: true };
}

/// 로스터리를 어드민이 직접 추가한다. 바로 승인 상태다.
export async function createVendorApproved(
  name: string,
  aliases: string[],
): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const trimmed = name.trim();
  const normalizedName = normalizeName(trimmed);
  if (!normalizedName) return { ok: false, message: "이름이 비어 있어요" };

  const dup = await prisma.vendor.findUnique({
    where: { normalizedName },
    select: { name: true },
  });
  if (dup) return { ok: false, message: `「${dup.name}」 와 같은 값이다` };

  await prisma.vendor.create({
    data: {
      name: trimmed,
      normalizedName,
      aliases: [...new Set(aliases.map((a) => a.trim()).filter(Boolean))],
      status: VendorStatus.APPROVED,
      createdById: await currentUserId(),
    },
  });
  revalidate("/admin");
  return { ok: true };
}

export async function listVendorsAdmin() {
  await requireAdmin();
  const rows = await prisma.vendor.findMany({
    select: {
      id: true,
      name: true,
      aliases: true,
      status: true,
      _count: { select: { products: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 300,
  });
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    aliases: v.aliases,
    status: v.status,
    productCount: v._count.products,
  }));
}

export async function listLookupsAdmin(kind: LookupKind) {
  await requireAdmin();
  return prisma.lookupValue.findMany({
    where: { kind },
    select: { id: true, nameKo: true, nameEn: true, aliases: true, status: true },
    orderBy: [{ sortWeight: "desc" }, { status: "asc" }, { nameKo: "asc" }],
    take: 400,
  });
}

/// 미매핑 raw 가 기존 어느 L2 에도 안 들어가는 새 향미 범주일 때.
/// 노드를 만들고 그 자리에서 붙인다 — 다른 화면에 갔다 오면 무엇을 붙이려던 건지 잃는다.
export async function createNodeAndAttach(
  raw: string,
  parentId: string,
  labelKo: string,
  labelEn: string,
): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const created = await createFlavorNodeL2(parentId, labelKo, labelEn);
  if (!created.ok) return created;
  return attachNote(raw, slugify(labelEn));
}

/// 승인하면서 이름까지 고친다.
/// 등록 중에 급히 친 표기가 그대로 굳으면 안 된다 — "Ombligon" 을 받아
/// "옴블리곤 / Ombligon" 으로 정돈하는 자리가 여기다.
export async function approveLookupEdited(
  id: string,
  nameKo: string,
  nameEn: string,
  aliases: string[],
): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const ko = nameKo.trim();
  const normalizedName = normalizeName(ko);
  if (!normalizedName) return { ok: false, message: "이름이 비어 있어요" };

  const current = await prisma.lookupValue.findUniqueOrThrow({
    where: { id },
    select: { kind: true, nameKo: true },
  });
  const dup = await prisma.lookupValue.findUnique({
    where: { kind_normalizedName: { kind: current.kind, normalizedName } },
    select: { id: true, nameKo: true },
  });
  if (dup && dup.id !== id) {
    return { ok: false, message: `「${dup.nameKo}」 와 같은 값이 된다. 흡수를 써달라` };
  }

  const clean = [...new Set(aliases.map((a) => a.trim()).filter(Boolean))];
  // 원래 표기를 별칭으로 남긴다. 다음에 같은 표기로 들어와도 갈라지지 않는다
  if (ko !== current.nameKo && !clean.includes(current.nameKo)) clean.push(current.nameKo);

  await prisma.lookupValue.update({
    where: { id },
    data: {
      nameKo: ko,
      nameEn: nameEn.trim() || null,
      normalizedName,
      aliases: clean,
      status: LookupStatus.APPROVED,
    },
  });
  revalidate("/admin");
  return { ok: true };
}

/// 오타 · 무의미한 값을 지운다. attributes JSONB 안의 참조도 함께 걷어낸다 —
/// FK 가 없어 남겨두면 고아 id 가 된다 (설계 4-3).
export async function rejectLookup(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  return prisma
    .$transaction(async (tx) => {
      const products = await tx.product.findMany({ select: { id: true, attributes: true } });
      for (const p of products) {
        const a = p.attributes as Record<string, unknown>;
        let touched = false;
        for (const key of ["countryId", "processId"]) {
          if (a[key] === id) {
            delete a[key];
            touched = true;
          }
        }
        for (const key of ["countryIds", "processIds", "varietyIds"]) {
          const list = a[key];
          if (Array.isArray(list) && list.includes(id)) {
            a[key] = list.filter((v) => v !== id);
            touched = true;
          }
        }
        if (touched) {
          await tx.product.update({
            where: { id: p.id },
            data: { attributes: a as Prisma.InputJsonValue },
          });
        }
      }
      await tx.lookupValue.delete({ where: { id } });
      return { ok: true as const };
    })
    .then((r) => {
      revalidate("/admin");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 로스터리는 원두가 붙어 있으면 못 지운다. 지우면 그 원두들이 갈 곳이 없다 —
/// 그런 경우는 삭제가 아니라 흡수다.
export async function rejectVendor(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const count = await prisma.product.count({ where: { vendorId: id } });
  if (count > 0) {
    return { ok: false, message: `원두 ${count}개가 붙어 있다. 흡수를 써달라` };
  }
  await prisma.vendor.delete({ where: { id } });
  revalidate("/admin");
  return { ok: true };
}

export type RecordDetail = {
  productId: string;
  productName: string;
  vendorName: string;
  fields: { label: string; value: string }[];
  notes: {
    id: string;
    raw: string;
    nodeId: string | null;
    /// 이 노트가 앉은 축의 색. 노드에 없으면 부모에서 상속한다 (설계 2026-09-08 §6).
    /// 미매핑이거나 계층 어디에도 색이 없으면 null — 회색으로 채우지 않는다
    nodeColor: string | null;
    value: NoteHitValueInput;
    /// 내가 기록한 뒤에 추가된 노트. 4-5 의 "안 건드림 = 못 느낌" 은 그 노트가 대조
    /// 화면에 떠 있었다는 전제 위에 서는데, 나중에 추가된 것은 그 전제가 깨진다 (설계 7-4)
    addedAfterRecord: boolean;
  }[];
  /// 판매자가 안 적었는데 내가 느낀 향. 판정이 없어 값이 아니라 목록이다
  extraNotes: NoteInput[];
  createdAt: string;
  updatedAt: string;
};

/// 목록에서 기록을 열 때 쓴다. 모달이라 목록을 떠나지 않으므로 필요한 것을 한 번에 싣는다.
export async function getRecordDetail(productId: string): Promise<RecordDetail | null> {
  const userId = await currentUserId();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      attributes: true,
      vendor: { select: { name: true } },
      sellerNotes: {
        select: {
          id: true,
          raw: true,
          nodeId: true,
          addedAt: true,
          // 띠를 그리려면 색이 필요하다. L2 에 색이 없으면 L1 에서 상속한다
          node: { select: { color: true, parent: { select: { color: true } } } },
        },
        orderBy: { position: "asc" },
      },
      experiences: {
        where: { userId },
        select: {
          createdAt: true,
          updatedAt: true,
          noteHits: { select: { sellerNoteId: true, value: true } },
          extraNotes: { select: { raw: true, nodeId: true }, orderBy: { createdAt: "asc" } },
        },
        take: 1,
      },
    },
  });
  if (!product) return null;

  // attributes 안의 lookup id 는 FK 가 없어 조인이 안 된다. 모아서 따로 읽는다 (설계 4-3)
  const ids = collectLookupIds(product.attributes);
  const lookups = ids.length
    ? await prisma.lookupValue.findMany({
        where: { id: { in: ids } },
        select: { id: true, nameKo: true },
      })
    : [];

  const exp = product.experiences[0];
  const values = new Map(exp?.noteHits.map((h) => [h.sellerNoteId, h.value]) ?? []);

  return {
    productId: product.id,
    productName: product.name,
    vendorName: product.vendor.name,
    fields: describeProduct(product.attributes, new Map(lookups.map((l) => [l.id, l.nameKo]))),
    notes: product.sellerNotes.map((n) => ({
      id: n.id,
      raw: n.raw,
      nodeId: n.nodeId,
      nodeColor: n.node?.color ?? n.node?.parent?.color ?? null,
      value: (values.get(n.id) ?? "MISS") as NoteHitValueInput,
      addedAfterRecord: !!exp && n.addedAt > exp.updatedAt,
    })),
    extraNotes: exp?.extraNotes ?? [],
    createdAt: (exp?.createdAt ?? new Date()).toISOString(),
    updatedAt: (exp?.updatedAt ?? new Date()).toISOString(),
  };
}

export type FlavorTreeNode = {
  id: string;
  labelKo: string;
  labelEn: string;
  /// 이 노드에 매핑된 판매자 노트 수. 축이 실제로 쓰이는지 보여준다
  noteCount: number;
  /// 이 노드로 붙인 표현들. 잘못 앉은 것을 찾는 유일한 방법이다
  aliases: { id: string; raw: string; scope: string }[];
  /// 이 노드에 직접 박힌 색. 없으면 null 이고 부모 것으로 칠해진다
  color: string | null;
  /// 화면이 실제로 칠하는 색 — 자기 색이 없으면 부모에서 상속한다 (설계 2026-09-08 §6).
  /// `color` 와 나란히 두는 이유는 **상속인지 제 색인지가 구별돼야** 하기 때문이다.
  /// 둘이 같으면 제 색, effectiveColor 만 있으면 상속, 둘 다 null 이면 색이 없다
  effectiveColor: string | null;
};

export async function listFlavorTreeDetailed() {
  await requireAdmin();
  const [nodes, aliases, counts] = await Promise.all([
    prisma.flavorNode.findMany({
      select: {
        id: true,
        level: true,
        parentId: true,
        labelKo: true,
        labelEn: true,
        color: true,
      },
      orderBy: [{ level: "asc" }, { labelKo: "asc" }],
    }),
    prisma.noteAlias.findMany({
      select: { id: true, raw: true, nodeId: true, scope: true },
      orderBy: { raw: "asc" },
    }),
    prisma.sellerNote.groupBy({ by: ["nodeId"], _count: { _all: true } }),
  ]);

  const countBy = new Map(counts.map((c) => [c.nodeId, c._count._all]));
  const aliasBy = new Map<string, FlavorTreeNode["aliases"]>();
  for (const a of aliases) {
    const list = aliasBy.get(a.nodeId) ?? [];
    list.push({ id: a.id, raw: a.raw, scope: a.scope });
    aliasBy.set(a.nodeId, list);
  }

  const colorOf = new Map(nodes.map((n) => [n.id, n.color]));
  const build = (n: (typeof nodes)[number]): FlavorTreeNode => ({
    id: n.id,
    labelKo: n.labelKo,
    labelEn: n.labelEn,
    noteCount: countBy.get(n.id) ?? 0,
    aliases: aliasBy.get(n.id) ?? [],
    color: n.color,
    effectiveColor: n.color ?? (n.parentId ? (colorOf.get(n.parentId) ?? null) : null),
  });

  return nodes
    .filter((n) => n.level === 1)
    .map((l1) => ({
      ...build(l1),
      children: nodes.filter((n) => n.parentId === l1.id).map(build),
    }));
}

/// 잘못 앉은 표현을 다른 축으로 옮긴다 (설계 7-4 NoteAlias 재매핑).
/// 그 표현을 쓰는 판매자 노트도 함께 옮기고 noteSetHash 를 재계산한다.
/// 판정값은 그대로 둔다 — 축이 바뀐 것이지 판정이 바뀐 게 아니다.
export async function remapAlias(aliasId: string, nodeId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  return prisma
    .$transaction(async (tx) => {
      const alias = await tx.noteAlias.findUniqueOrThrow({
        where: { id: aliasId },
        select: { raw: true, nodeId: true },
      });
      if (alias.nodeId === nodeId) throw new Error("같은 축이다");

      await tx.noteAlias.update({ where: { id: aliasId }, data: { nodeId } });

      const targets = await tx.sellerNote.findMany({
        where: { raw: alias.raw, nodeId: alias.nodeId },
        select: { id: true, productId: true },
      });
      await tx.sellerNote.updateMany({
        where: { id: { in: targets.map((t) => t.id) } },
        data: { nodeId },
      });

      for (const productId of new Set(targets.map((t) => t.productId))) {
        const r = await recomputeHash(tx, productId);
        if (!r.ok) {
          throw new Error(`옮기면 「${r.conflictName}」 과 같은 원두가 된다. 병합이 먼저다`);
        }
      }
      return { ok: true as const };
    })
    .then((r) => {
      revalidate("/admin");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 매핑 자체가 틀렸을 때. 별칭을 지우고 그 표현을 쓰는 노트를 미매핑으로 되돌린다 —
/// 다시 판단할 수 있게 큐로 보내는 것이지 데이터를 버리는 것이 아니다.
export async function unmapAlias(aliasId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  return prisma
    .$transaction(async (tx) => {
      const alias = await tx.noteAlias.findUniqueOrThrow({
        where: { id: aliasId },
        select: { raw: true, nodeId: true },
      });

      const targets = await tx.sellerNote.findMany({
        where: { raw: alias.raw, nodeId: alias.nodeId },
        select: { id: true, productId: true },
      });
      await tx.sellerNote.updateMany({
        where: { id: { in: targets.map((t) => t.id) } },
        data: { nodeId: null },
      });
      await tx.noteAlias.delete({ where: { id: aliasId } });

      for (const productId of new Set(targets.map((t) => t.productId))) {
        const r = await recomputeHash(tx, productId);
        if (!r.ok) {
          throw new Error(`되돌리면 「${r.conflictName}」 과 같은 원두가 된다. 병합이 먼저다`);
        }
      }
      return { ok: true as const };
    })
    .then((r) => {
      revalidate("/admin");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

// ─────────────────────────────────────────── Product 수정 (누구나)
//
// Product 은 공유 자산이지만 수정을 막지 않는다. 읽는 쪽이 sellerNotes 를 기준으로
// 렌더하고 noteHits 가 없으면 MISS 로 채우므로, 노트가 늘어도 기존 기록이 깨지지 않는다 —
// 다음에 그 기록을 여는 순간 새 노트가 `못 느낌` 으로 나타난다.
// 위험한 것은 삭제뿐이라 거기만 막는다.

/// 노트 추가는 어드민만 한다 (요구 FR-9).
///
/// 사용자 화면에서 열어두면 **남의 기록에 항목을 밀어넣는 조작**이 된다 — 추가된 노트는
/// 기존 기록에 `못 느낌` 으로 소급 반영된다. 설계 4-3 개정이 안전하다고 한 것은
/// *데이터가 안 깨진다*는 뜻이지 *남이 내 기록을 늘려도 된다*는 뜻이 아니었다.
/// 게다가 noteSetHash 를 움직여 다른 원두와 키가 충돌하면 막히는데, 그때 사용자가
/// 할 수 있는 것이 없다 (병합이 없다).
export async function addSellerNote(
  productId: string,
  raw: string,
  nodeId: string | null,
): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "노트가 비어 있어요" };

  return prisma
    .$transaction(async (tx) => {
      const dup = await tx.sellerNote.findFirst({
        where: { productId, raw: trimmed },
        select: { id: true },
      });
      if (dup) throw new Error("이미 있는 노트다");

      const last = await tx.sellerNote.findFirst({
        where: { productId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      await tx.sellerNote.create({
        data: { productId, raw: trimmed, nodeId, position: (last?.position ?? -1) + 1 },
      });

      const r = await recomputeHash(tx, productId);
      if (!r.ok) throw new Error(`추가하면 「${r.conflictName}」 과 같은 원두가 된다`);
      return { ok: true as const };
    })
    .then((r) => {
      revalidate("/");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 표기 수정은 소급이 아니다 — nodeId 가 그대로면 판정의 좌변이 안 바뀐다 (설계 7-4).
/// 축까지 바꾸면 집계만 갈아타고 판정값은 유지된다.
export async function updateSellerNote(
  sellerNoteId: string,
  raw: string,
  nodeId: string | null,
): Promise<AdminResult> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "노트가 비어 있어요" };

  return prisma
    .$transaction(async (tx) => {
      const note = await tx.sellerNote.findUniqueOrThrow({
        where: { id: sellerNoteId },
        select: { productId: true },
      });
      await tx.sellerNote.update({
        where: { id: sellerNoteId },
        data: { raw: trimmed, nodeId },
      });
      const r = await recomputeHash(tx, note.productId);
      if (!r.ok) throw new Error(`고치면 「${r.conflictName}」 과 같은 원두가 된다`);
      return { ok: true as const };
    })
    .then((r) => {
      revalidate("/");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 판정이 붙은 노트는 지우지 않는다. 사용자가 실제로 찍은 판정은 사실이고,
/// 판매자 노트가 잘못이었다는 것이 그 판정을 없앨 근거는 아니다 (설계 7-4).
/// 표기가 틀린 것이면 수정으로 바꿔 쓴다.
/// 삭제도 어드민만 한다. 판정이 붙었거나 마지막 하나면 여기서 또 막힌다 —
/// 권한과 별개로 그 둘은 누가 하든 안 된다
export async function deleteSellerNote(sellerNoteId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  return prisma
    .$transaction(async (tx) => {
      const note = await tx.sellerNote.findUniqueOrThrow({
        where: { id: sellerNoteId },
        select: { productId: true, raw: true, _count: { select: { noteHits: true } } },
      });
      if (note._count.noteHits > 0) {
        throw new Error(
          `“${note.raw}” 에 판정 ${note._count.noteHits}건이 붙어 있다. 표기가 틀린 것이면 수정해서 쓴다`,
        );
      }
      const remaining = await tx.sellerNote.count({ where: { productId: note.productId } });
      if (remaining <= 1) throw new Error("마지막 노트는 지울 수 없다");

      await tx.sellerNote.delete({ where: { id: sellerNoteId } });
      const r = await recomputeHash(tx, note.productId);
      if (!r.ok) throw new Error(`지우면 「${r.conflictName}」 과 같은 원두가 된다`);
      return { ok: true as const };
    })
    .then((r) => {
      revalidate("/");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 제품명은 normalizedName 을 통해 동일성 키에 들어간다. 바꾸면 키가 움직인다.
export async function updateProductName(productId: string, name: string): Promise<AdminResult> {
  const trimmed = name.trim();
  const normalizedName = normalizeName(trimmed);
  if (!normalizedName) return { ok: false, message: "제품명이 비어 있어요" };

  const current = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { vendorId: true, category: true, noteSetHash: true },
  });
  const clash = await prisma.product.findUnique({
    where: {
      vendorId_category_normalizedName_noteSetHash: {
        vendorId: current.vendorId,
        category: current.category,
        normalizedName,
        noteSetHash: current.noteSetHash,
      },
    },
    select: { id: true, name: true },
  });
  if (clash && clash.id !== productId) {
    return { ok: false, message: `「${clash.name}」 과 같은 원두가 된다` };
  }

  await prisma.product.update({
    where: { id: productId },
    data: { name: trimmed, normalizedName },
  });
  revalidate("/");
  return { ok: true };
}

export async function updateProductAttributes(
  productId: string,
  attributes: Record<string, unknown>,
): Promise<AdminResult> {
  await prisma.product.update({
    where: { id: productId },
    data: { attributes: attributes as Prisma.InputJsonValue },
  });
  revalidate("/");
  return { ok: true };
}

export type NoteDistribution = {
  id: string;
  raw: string;
  nodeId: string | null;
  nodeLabel: string | null;
  /// 이 노트가 앉은 축의 색. 노드에 없으면 부모에서 상속한다 (설계 2026-09-08 §6).
  /// 미매핑이거나 계층 어디에도 색이 없으면 null — 회색으로 채우지 않는다
  nodeColor: string | null;
  /// 판정 분포. 표본 수를 항상 함께 보여준다 (설계 7-3)
  counts: { STRONG: number; WEAK: number; UNSURE: number; MISS: number };
  hitCount: number;
  myValue: NoteHitValueInput | null;
};

export type ProductDetail = {
  id: string;
  name: string;
  vendorName: string;
  vendorId: string;
  attributes: Record<string, unknown>;
  fields: { label: string; value: string }[];
  notes: NoteDistribution[];
  /// 이 원두를 기록한 사람 수. 설계 전제 ① — 이 값은 오래도록 1에 머문다
  sampleSize: number;
  hasMyRecord: boolean;
  /// 판매자가 안 적었는데 사람들이 느낀 향. 표현(raw) 단위로 묶는다 —
  /// 노드로 묶으면 "열대과일 2명" 이 되어 무엇을 적었는지가 사라진다
  peopleExtraNotes: { raw: string; nodeId: string | null; nodeLabel: string | null; count: number }[];
};

/// 사람마다 적은 향을 표현 단위로 묶는다. 같은 사람이 같은 표현을 두 번 적는 일은
/// 저장 쪽에서 막지 않으므로 여기서 사람 단위로 한 번만 센다
function aggregateExtraNotes(
  experiences: {
    userId: string;
    extraNotes: { raw: string; nodeId: string | null; node: { labelKo: string } | null }[];
  }[],
): ProductDetail["peopleExtraNotes"] {
  const byRaw = new Map<
    string,
    { raw: string; nodeId: string | null; nodeLabel: string | null; users: Set<string> }
  >();
  for (const e of experiences) {
    for (const n of e.extraNotes) {
      const row =
        byRaw.get(n.raw) ??
        { raw: n.raw, nodeId: n.nodeId, nodeLabel: n.node?.labelKo ?? null, users: new Set<string>() };
      row.users.add(e.userId);
      byRaw.set(n.raw, row);
    }
  }
  return [...byRaw.values()]
    .map(({ users, ...rest }) => ({ ...rest, count: users.size }))
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw, "ko"));
}

export async function getProductDetail(productId: string): Promise<ProductDetail | null> {
  const userId = await currentUserId();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      attributes: true,
      vendorId: true,
      vendor: { select: { name: true } },
      sellerNotes: {
        select: {
          id: true,
          raw: true,
          nodeId: true,
          node: { select: { labelKo: true, color: true, parent: { select: { color: true } } } },
          noteHits: { select: { value: true, experience: { select: { userId: true } } } },
        },
        orderBy: { position: "asc" },
      },
      experiences: {
        select: {
          userId: true,
          extraNotes: {
            select: { raw: true, nodeId: true, node: { select: { labelKo: true } } },
          },
        },
      },
    },
  });
  if (!product) return null;

  const ids = collectLookupIds(product.attributes);
  const lookups = ids.length
    ? await prisma.lookupValue.findMany({
        where: { id: { in: ids } },
        select: { id: true, nameKo: true },
      })
    : [];

  return {
    id: product.id,
    name: product.name,
    vendorName: product.vendor.name,
    vendorId: product.vendorId,
    attributes: (product.attributes ?? {}) as Record<string, unknown>,
    fields: describeProduct(product.attributes, new Map(lookups.map((l) => [l.id, l.nameKo]))),
    sampleSize: product.experiences.length,
    hasMyRecord: product.experiences.some((e) => e.userId === userId),
    peopleExtraNotes: aggregateExtraNotes(product.experiences),
    notes: product.sellerNotes.map((n) => {
      const counts = { STRONG: 0, WEAK: 0, UNSURE: 0, MISS: 0 };
      let mine: NoteHitValueInput | null = null;
      for (const h of n.noteHits) {
        counts[h.value] += 1;
        if (h.experience.userId === userId) mine = h.value;
      }
      // 판정을 안 남긴 사람에게도 이 노트는 `못 느낌` 이다 (설계 4-5 · 6장)
      counts.MISS += product.experiences.length - n.noteHits.length;
      return {
        id: n.id,
        raw: n.raw,
        nodeId: n.nodeId,
        nodeLabel: n.node?.labelKo ?? null,
        nodeColor: n.node?.color ?? n.node?.parent?.color ?? null,
        counts,
        hitCount: counts.STRONG + counts.WEAK,
        myValue: mine,
      };
    }),
  };
}

// ─────────────────────────────────────────── 계정 · 초대 코드 (설계 5)

export type InviteCodeRow = {
  id: string;
  code: string;
  label: string;
  expiresAt: Date;
  expired: boolean;
  usedBy: { id: string; displayName: string } | null;
  /// `usedBy` 가 있으면 항상 같이 있다 (설계 10-5). 2차 이전에 소진된 코드는 없다
  usedAt: Date | null;
  createdAt: Date;
};

/// 초대 코드를 발급한다. **label 이 곧 새 계정의 표시명이다** (설계 5-3) —
/// 교환 화면은 코드 6자리만 받는다.
export async function issueInviteCode(label: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, message: "누구에게 주는 코드인지 적어 주세요" };

  const issuer = await currentUserId();
  // code 가 unique 라 100만 분의 1로 부딪힌다. 세 번까지 다시 뽑는다 —
  // 부딪혔다고 사람에게 되묻는 것은 사람이 할 수 있는 게 없는 요청이다
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.inviteCode.create({
        data: {
          code: generateInviteCode(),
          label: trimmed,
          createdById: issuer,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
      return { ok: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return { ok: false, message: "코드가 계속 겹쳐요. 다시 눌러 주세요" };
}

/// 만료는 지우지 않고 표시만 한다. **언제 누구에게 뭘 발급했는지가 기록이다.**
export async function listInviteCodes(): Promise<InviteCodeRow[]> {
  await requireAdmin();
  const rows = await prisma.inviteCode.findMany({
    select: {
      id: true,
      code: true,
      label: true,
      expiresAt: true,
      createdAt: true,
      usedAt: true,
      usedBy: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const now = Date.now();
  return rows.map((r) => ({ ...r, expired: r.expiresAt.getTime() < now }));
}

/// 잘못 발급한 코드를 지운다.
///
/// **소진된 코드는 못 지운다.** 지우면 그 계정이 어떤 초대로 들어왔는지가 사라진다 —
/// 초대제에서 그 연결이 유일한 계보다.
export async function revokeInviteCode(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const row = await prisma.inviteCode.findUnique({
    where: { id },
    select: { usedByUserId: true },
  });
  if (!row) return { ok: false, message: "없는 코드예요" };
  if (row.usedByUserId) return { ok: false, message: "이미 쓴 코드는 못 지워요" };
  await prisma.inviteCode.delete({ where: { id } });
  return { ok: true };
}

/// 초대 코드를 교환해 계정을 만들고 세션을 굽는다 (설계 10-3).
///
/// **어드민 액션이 아니다.** 로그인하지 않은 사람만 부르는 유일한 액션이고,
/// `proxy.ts` 의 matcher 에서 `/join` 을 뺀 이유가 이것이다.
///
/// **실패 사유를 구분해서 알려주지 않는다.** 없는 코드 · 만료 · 소진이 전부 같은 문구다 —
/// 구분해 주면 자동 대입하는 쪽에 "이 코드는 존재한다" 를 알려주게 된다.
export async function redeemInviteCode(code: string): Promise<AdminResult> {
  const ip = await clientIp();

  // take 로 읽는 양을 묶는다. 잠금 판정에 필요한 것은 최근 ATTEMPT_LIMIT 개가 전부다
  const recent = await prisma.inviteAttempt.findMany({
    where: { ip },
    orderBy: { at: "desc" },
    take: ATTEMPT_LIMIT,
    select: { at: true },
  });
  if (isLockedOut(recent.map((r) => r.at))) {
    return { ok: false, message: "시도가 너무 많아요. 잠시 뒤에 다시 해 주세요" };
  }

  // 실패는 전부 이 한 곳을 지난다 — 행을 남기는 것을 빠뜨릴 자리가 없어진다
  const fail = async (): Promise<AdminResult> => {
    await prisma.inviteAttempt.create({ data: { ip } });
    return { ok: false, message: "코드가 맞지 않아요" };
  };

  const trimmed = code.trim();
  if (!/^[0-9]{6}$/.test(trimmed)) return fail();

  const invite = await prisma.inviteCode.findUnique({
    where: { code: trimmed },
    select: { id: true, label: true, expiresAt: true, usedByUserId: true },
  });
  if (!invite || invite.usedByUserId || invite.expiresAt.getTime() < Date.now()) return fail();

  const user = await prisma
    .$transaction(async (tx) => {
      const created = await tx.user.create({ data: { displayName: invite.label } });
      // **경쟁은 DB 가 막는다.** 위의 조회와 여기 사이에 남이 같은 코드를 쓸 수 있다 —
      // `usedByUserId: null` 조건이 안 맞으면 count 가 0 이고 트랜잭션째 되돌아가
      // 방금 만든 User 도 같이 사라진다. 애플리케이션 검사에만 기대지 않는다
      const claimed = await tx.inviteCode.updateMany({
        where: { id: invite.id, usedByUserId: null },
        data: { usedByUserId: created.id, usedAt: new Date() },
      });
      if (claimed.count === 0) throw new Error("이미 소진된 코드");
      return created;
    })
    .catch(() => null);

  if (!user) return fail();

  // 성공하면 이 IP 의 실패 기록을 지운다. 정상 사용에서는 이 테이블이 비어 있다 (설계 10-4)
  await prisma.inviteAttempt.deleteMany({ where: { ip } });
  await issueSession(user.id);
  return { ok: true };
}

/// role 변경은 없다. 어드민이 하나뿐이라 승격할 대상이 존재하지 않는다 (설계 5-5).
export async function listAccounts() {
  await requireAdmin();
  return prisma.user.findMany({
    select: { id: true, displayName: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}
