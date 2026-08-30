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
import { currentUserId } from "@/lib/current-user";
import { computeNoteSetHash } from "@/lib/note-set-hash";
import { normalizeName } from "@/lib/normalize";
import { collectLookupIds, describeProduct } from "@/lib/product-display";

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

/// sortWeight 가 큰 것부터. 커피 산지를 목록 위로 올리는 자리다 (설계 4-8).

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
    orderBy: [{ sortWeight: "desc" }, { status: "asc" }, { nameKo: "asc" }],
    take: q ? 12 : 60,
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
): Promise<{ ok: true }> {
  const userId = currentUserId();

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
  });

  revalidatePath("/");
  return { ok: true };
}

export async function deleteRecord(productId: string): Promise<{ ok: true }> {
  await prisma.experience.deleteMany({ where: { userId: currentUserId(), productId } });
  revalidatePath("/");
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

export type UnmappedNote = {
  id: string;
  raw: string;
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
  const rows = await prisma.sellerNote.findMany({
    where: { nodeId: null },
    select: {
      id: true,
      raw: true,
      productId: true,
      product: { select: { name: true, vendor: { select: { name: true } } } },
    },
    orderBy: { addedAt: "asc" },
    take: 200,
  });

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.raw, (counts.get(r.raw) ?? 0) + 1);

  return rows.map((r) => ({
    id: r.id,
    raw: r.raw,
    productId: r.productId,
    productName: r.product.name,
    vendorName: r.product.vendor.name,
    sameRawCount: counts.get(r.raw) ?? 1,
  }));
}

export type AdminResult = { ok: true } | { ok: false; message: string };

/// raw 를 노드에 붙인다. 같은 raw 를 쓰는 다른 미매핑 항목도 함께 붙는다 —
/// 하나씩 보는 것보다 모아 보는 편이 판단이 정확하다는 것이 이 큐의 전제다.
export async function attachNote(raw: string, nodeId: string): Promise<AdminResult> {
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

export async function listFlavorTree() {
  const nodes = await prisma.flavorNode.findMany({
    select: { id: true, level: true, parentId: true, labelKo: true },
    orderBy: [{ level: "asc" }, { labelKo: "asc" }],
  });
  return nodes
    .filter((n) => n.level === 1)
    .map((l1) => ({ ...l1, children: nodes.filter((n) => n.parentId === l1.id) }));
}

export async function adminStats() {
  const [unmapped, mapped, pendingVendors, pendingLookups, products, vendors, records] =
    await Promise.all([
      prisma.sellerNote.count({ where: { nodeId: null } }),
      prisma.sellerNote.count({ where: { nodeId: { not: null } } }),
      prisma.vendor.count({ where: { status: VendorStatus.PENDING } }),
      prisma.lookupValue.count({ where: { status: LookupStatus.PENDING } }),
      prisma.product.count(),
      prisma.vendor.count(),
      prisma.experience.count(),
    ]);
  return { unmapped, mapped, pendingVendors, pendingLookups, products, vendors, records };
}

export type PendingVendor = { id: string; name: string; productCount: number };
export type PendingLookup = { id: string; kind: LookupKind; nameKo: string; nameEn: string | null };

export async function listPending() {
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

export async function approveVendor(id: string): Promise<AdminResult> {
  await prisma.vendor.update({ where: { id }, data: { status: VendorStatus.APPROVED } });
  revalidatePath("/admin");
  return { ok: true };
}

export async function approveLookup(id: string): Promise<AdminResult> {
  await prisma.lookupValue.update({ where: { id }, data: { status: LookupStatus.APPROVED } });
  revalidatePath("/admin");
  return { ok: true };
}

/// 병합의 실체는 삭제가 아니라 **흡수**다 (설계 4-8).
/// 없어지는 쪽의 이름과 별칭이 남는 쪽의 aliases 로 들어가야
/// 다음에 같은 표기가 들어와도 다시 갈라지지 않는다.
export async function mergeLookup(sourceId: string, targetId: string): Promise<AdminResult> {
  if (sourceId === targetId) return { ok: false, message: "같은 항목이다" };

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
      revalidatePath("/admin");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

export async function listLookupsByKind(kind: LookupKind) {
  return prisma.lookupValue.findMany({
    where: { kind, status: LookupStatus.APPROVED },
    select: { id: true, nameKo: true },
    orderBy: [{ sortWeight: "desc" }, { nameKo: "asc" }],
    take: 300,
  });
}

/// 승인하면서 별칭을 같이 받는다. 표기 흔들림을 흡수하는 경로가 aliases 뿐이라
/// 승인 시점이 그걸 적어둘 유일한 자리다 (설계 4-2 · 4-8).
export async function approveLookupWith(id: string, aliases: string[]): Promise<AdminResult> {
  const clean = [...new Set(aliases.map((a) => a.trim()).filter(Boolean))];
  await prisma.lookupValue.update({
    where: { id },
    data: { status: LookupStatus.APPROVED, ...(clean.length ? { aliases: clean } : {}) },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function approveVendorWith(id: string, aliases: string[]): Promise<AdminResult> {
  const clean = [...new Set(aliases.map((a) => a.trim()).filter(Boolean))];
  await prisma.vendor.update({
    where: { id },
    data: { status: VendorStatus.APPROVED, ...(clean.length ? { aliases: clean } : {}) },
  });
  revalidatePath("/admin");
  return { ok: true };
}

/// 로스터리 병합. Product 동일성 키에 vendorId 가 들어가므로 아래 원두의 키가
/// 전부 움직인다 — 이전 후 대상 아래에서 중복을 다시 검사해야 한다 (설계 7-4).
export async function mergeVendor(sourceId: string, targetId: string): Promise<AdminResult> {
  if (sourceId === targetId) return { ok: false, message: "같은 로스터리다" };

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
      revalidatePath("/admin");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

export async function listApprovedVendors() {
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
  const ko = labelKo.trim();
  const en = labelEn.trim();
  const id = slugify(en);
  if (!ko || !en) return { ok: false, message: "한글 · 영문 라벨이 둘 다 필요하다" };
  if (!id) return { ok: false, message: "영문 라벨에서 id 를 만들 수 없다" };

  const parent = await prisma.flavorNode.findUnique({
    where: { id: parentId },
    select: { level: true },
  });
  if (!parent || parent.level !== 1) return { ok: false, message: "부모는 Level 1 이어야 한다" };
  if (await prisma.flavorNode.findUnique({ where: { id }, select: { id: true } })) {
    return { ok: false, message: `id "${id}" 가 이미 있다` };
  }

  await prisma.flavorNode.create({
    data: { id, level: 2, parentId, labelKo: ko, labelEn: en },
  });
  revalidatePath("/admin");
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
  const ko = nameKo.trim();
  const normalizedName = normalizeName(ko);
  if (!normalizedName) return { ok: false, message: "이름이 비어 있다" };

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
      createdById: currentUserId(),
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}

/// 로스터리를 어드민이 직접 추가한다. 바로 승인 상태다.
export async function createVendorApproved(
  name: string,
  aliases: string[],
): Promise<AdminResult> {
  const trimmed = name.trim();
  const normalizedName = normalizeName(trimmed);
  if (!normalizedName) return { ok: false, message: "이름이 비어 있다" };

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
      createdById: currentUserId(),
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function listVendorsAdmin() {
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
  const ko = nameKo.trim();
  const normalizedName = normalizeName(ko);
  if (!normalizedName) return { ok: false, message: "이름이 비어 있다" };

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
  revalidatePath("/admin");
  return { ok: true };
}

/// 오타 · 무의미한 값을 지운다. attributes JSONB 안의 참조도 함께 걷어낸다 —
/// FK 가 없어 남겨두면 고아 id 가 된다 (설계 4-3).
export async function rejectLookup(id: string): Promise<AdminResult> {
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
      revalidatePath("/admin");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 로스터리는 원두가 붙어 있으면 못 지운다. 지우면 그 원두들이 갈 곳이 없다 —
/// 그런 경우는 삭제가 아니라 흡수다.
export async function rejectVendor(id: string): Promise<AdminResult> {
  const count = await prisma.product.count({ where: { vendorId: id } });
  if (count > 0) {
    return { ok: false, message: `원두 ${count}개가 붙어 있다. 흡수를 써달라` };
  }
  await prisma.vendor.delete({ where: { id } });
  revalidatePath("/admin");
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
    value: NoteHitValueInput;
    /// 내가 기록한 뒤에 추가된 노트. 4-5 의 "안 건드림 = 못 느낌" 은 그 노트가 대조
    /// 화면에 떠 있었다는 전제 위에 서는데, 나중에 추가된 것은 그 전제가 깨진다 (설계 7-4)
    addedAfterRecord: boolean;
  }[];
  createdAt: string;
  updatedAt: string;
};

/// 목록에서 기록을 열 때 쓴다. 모달이라 목록을 떠나지 않으므로 필요한 것을 한 번에 싣는다.
export async function getRecordDetail(productId: string): Promise<RecordDetail | null> {
  const userId = currentUserId();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      attributes: true,
      vendor: { select: { name: true } },
      sellerNotes: {
        select: { id: true, raw: true, nodeId: true, addedAt: true },
        orderBy: { position: "asc" },
      },
      experiences: {
        where: { userId },
        select: {
          createdAt: true,
          updatedAt: true,
          noteHits: { select: { sellerNoteId: true, value: true } },
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
      value: (values.get(n.id) ?? "MISS") as NoteHitValueInput,
      addedAfterRecord: !!exp && n.addedAt > exp.updatedAt,
    })),
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
};

export async function listFlavorTreeDetailed() {
  const [nodes, aliases, counts] = await Promise.all([
    prisma.flavorNode.findMany({
      select: { id: true, level: true, parentId: true, labelKo: true, labelEn: true },
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

  const build = (n: (typeof nodes)[number]): FlavorTreeNode => ({
    id: n.id,
    labelKo: n.labelKo,
    labelEn: n.labelEn,
    noteCount: countBy.get(n.id) ?? 0,
    aliases: aliasBy.get(n.id) ?? [],
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
      revalidatePath("/admin");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 매핑 자체가 틀렸을 때. 별칭을 지우고 그 표현을 쓰는 노트를 미매핑으로 되돌린다 —
/// 다시 판단할 수 있게 큐로 보내는 것이지 데이터를 버리는 것이 아니다.
export async function unmapAlias(aliasId: string): Promise<AdminResult> {
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
      revalidatePath("/admin");
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

export async function addSellerNote(
  productId: string,
  raw: string,
  nodeId: string | null,
): Promise<AdminResult> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "노트가 비어 있다" };

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
      revalidatePath("/");
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
  if (!trimmed) return { ok: false, message: "노트가 비어 있다" };

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
      revalidatePath("/");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 판정이 붙은 노트는 지우지 않는다. 사용자가 실제로 찍은 판정은 사실이고,
/// 판매자 노트가 잘못이었다는 것이 그 판정을 없앨 근거는 아니다 (설계 7-4).
/// 표기가 틀린 것이면 수정으로 바꿔 쓴다.
export async function deleteSellerNote(sellerNoteId: string): Promise<AdminResult> {
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
      revalidatePath("/");
      return r;
    })
    .catch((e: Error) => ({ ok: false as const, message: e.message }));
}

/// 제품명은 normalizedName 을 통해 동일성 키에 들어간다. 바꾸면 키가 움직인다.
export async function updateProductName(productId: string, name: string): Promise<AdminResult> {
  const trimmed = name.trim();
  const normalizedName = normalizeName(trimmed);
  if (!normalizedName) return { ok: false, message: "제품명이 비어 있다" };

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
  revalidatePath("/");
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
  revalidatePath("/");
  return { ok: true };
}

export type NoteDistribution = {
  id: string;
  raw: string;
  nodeId: string | null;
  nodeLabel: string | null;
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
};

export async function getProductDetail(productId: string): Promise<ProductDetail | null> {
  const userId = currentUserId();
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
          node: { select: { labelKo: true } },
          noteHits: { select: { value: true, experience: { select: { userId: true } } } },
        },
        orderBy: { position: "asc" },
      },
      experiences: { select: { userId: true } },
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
        counts,
        hitCount: counts.STRONG + counts.WEAK,
        myValue: mine,
      };
    }),
  };
}
