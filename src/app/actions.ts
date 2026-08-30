"use server";

import { LookupStatus, VendorStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { currentUserId } from "@/lib/current-user";
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
