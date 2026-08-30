"use server";

import { Category, LookupStatus, Prisma, VendorStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { currentUserId } from "@/lib/current-user";
import { computeNoteSetHash } from "@/lib/note-set-hash";
import { normalizeName } from "@/lib/normalize";

export type VendorHit = { id: string; name: string; status: VendorStatus };
export type ProductHit = { id: string; name: string; noteCount: number; hasRecord: boolean };

/// 로스터리 검색 (요구 FR-1).
/// pg_trgm 유사도로 근접 후보를 찾는다 — 표기 흔들림을 흡수하는 검색의 전제다.
/// aliases 배열도 같이 훑는다 (설계 4-2).
export async function searchVendors(query: string): Promise<VendorHit[]> {
  const q = normalizeName(query);
  if (q.length === 0) return [];

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
      createdById: currentUserId(),
    },
    select: { id: true, name: true, status: true },
  });
  return vendor;
}

/// 선택한 로스터리 안에서 원두를 찾는다 (요구 FR-2).
/// 이미 내 기록이 붙어 있으면 표시한다 — 다시 고르면 새 기록이 아니라 편집으로 간다 (FR-6).
export async function searchProducts(vendorId: string, query: string): Promise<ProductHit[]> {
  const userId = currentUserId();
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

/// 등록 폼의 접힌 상세에 쓰는 lookup. 승인된 것과 내가 추가한 pending 이 같이 보인다.
export async function listApprovedLookups(kind: "COUNTRY" | "VARIETY" | "PROCESS") {
  return prisma.lookupValue.findMany({
    where: { kind, status: LookupStatus.APPROVED },
    select: { id: true, nameKo: true },
    orderBy: { nameKo: "asc" },
  });
}

export type NoteSuggestion = { raw: string; nodeId: string; labelKo: string };

/// 노트 자동완성 (설계 7-1 — 노트 입력이 유일한 진짜 병목이다).
/// 이미 등록된 raw 표현과 노드 라벨을 함께 제안한다. NoteAlias 가 자랄수록
/// 타이핑이 줄어 노트 입력도 탭에 수렴한다.
export async function searchNoteSuggestions(query: string): Promise<NoteSuggestion[]> {
  const q = query.trim();
  if (q.length === 0) return [];

  const [aliases, nodes] = await Promise.all([
    prisma.noteAlias.findMany({
      where: { normalizedRaw: { contains: normalizeName(q) } },
      select: { raw: true, nodeId: true, node: { select: { labelKo: true } } },
      orderBy: { usageCount: "desc" },
      take: 6,
    }),
    // 집계 축은 Level 2 다. Level 1 을 제안하면 해상도가 없는 노드가 붙는다
    prisma.flavorNode.findMany({
      where: { level: 2, OR: [{ labelKo: { contains: q } }, { labelEn: { contains: q, mode: "insensitive" } }] },
      select: { id: true, labelKo: true },
      take: 6,
    }),
  ]);

  const seen = new Set<string>();
  const out: NoteSuggestion[] = [];
  for (const a of aliases) {
    if (seen.has(a.raw)) continue;
    seen.add(a.raw);
    out.push({ raw: a.raw, nodeId: a.nodeId, labelKo: a.node.labelKo });
  }
  for (const n of nodes) {
    if (seen.has(n.labelKo)) continue;
    seen.add(n.labelKo);
    out.push({ raw: n.labelKo, nodeId: n.id, labelKo: n.labelKo });
  }
  return out.slice(0, 8);
}

export type LookupOption = { id: string; nameKo: string; status: LookupStatus };

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
    select: { id: true, nameKo: true, status: true },
    orderBy: [{ status: "asc" }, { nameKo: "asc" }],
    take: q ? 12 : 200,
  });
}

/// lookup 에 값이 없다는 이유로 기록이 막히면 안 된다 (설계 4-8).
/// country 는 닫힌 집합이라 막는다.
export async function createLookup(
  kind: "VARIETY" | "PROCESS",
  nameKo: string,
): Promise<LookupOption> {
  const trimmed = nameKo.trim();
  const normalizedName = normalizeName(trimmed);
  if (!normalizedName) throw new Error("이름이 비어 있다");

  return prisma.lookupValue.upsert({
    where: { kind_normalizedName: { kind, normalizedName } },
    update: {},
    create: {
      kind,
      nameKo: trimmed,
      normalizedName,
      status: LookupStatus.PENDING,
      createdById: currentUserId(),
    },
    select: { id: true, nameKo: true, status: true },
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

  if (!normalizedName) return { ok: false, reason: "invalid", message: "제품명을 적어달라" };
  // 노트가 없으면 대조할 것이 없어 엔진 입력이 0이다 (설계 4-3)
  if (notes.length === 0) return { ok: false, reason: "invalid", message: "판매자 노트가 최소 1개 필요하다" };

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
      createdById: currentUserId(),
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
