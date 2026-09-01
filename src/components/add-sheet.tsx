"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  createVendor,
  searchProducts,
  searchProductsGlobal,
  searchVendors,
  type ProductGlobalHit,
  type ProductHit,
  type VendorHit,
} from "@/app/actions";
import { MIN_QUERY_LENGTH } from "@/lib/search-tuning";

// 흐름은 검색 → (로스터리를 골랐으면) 그 안의 원두명 두 단계다.
// 첫 단계에서 원두가 바로 나오면 로스터리 단계를 건너뛴다 (요구 FR-1 · FR-2 개정).
//
// 검색만 시트로 두는 이유 — 짧고 휘발적이라 취소하고 나가는 게 흔하고, 잃을 입력이
// 없다. 반면 등록 폼은 타이핑이 길어 실수로 닫히면 손해가 크므로 라우트로 나간다.
type Step = "vendor" | "product";

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function AddSheet({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("vendor");
  const [vendor, setVendor] = useState<VendorHit | null>(null);

  const back = () => {
    if (step === "product") {
      setStep("vendor");
      setVendor(null);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <div className="flex h-14 shrink-0 items-center justify-between px-2">
        <button
          type="button"
          onClick={back}
          className="flex h-11 items-center rounded-[10px] px-3 text-[15px] text-muted"
        >
          {step === "product" ? "뒤로" : "닫기"}
        </button>
      </div>

      {/* 고른 로스터리는 상단에 남는다 — 지금 어느 로스터리 안에 있는지가
          원두명 검색 내내 보여야 한다 */}
      {vendor && (
        <div className="mx-4 mb-3 flex min-h-14 items-center justify-between rounded-[10px] bg-surface-card px-4">
          <span>
            <span className="block text-[12px] text-muted">로스터리</span>
            <span className="block text-[17px] font-semibold text-ink">{vendor.name}</span>
          </span>
          <button
            type="button"
            onClick={back}
            className="flex h-11 items-center rounded-[10px] px-2 text-[14px] text-muted"
          >
            변경
          </button>
        </div>
      )}

      {step === "vendor" ? (
        <SearchStep
          onPickVendor={(v) => {
            setVendor(v);
            setStep("product");
          }}
        />
      ) : (
        vendor && <ProductStep vendor={vendor} />
      )}
    </div>
  );
}

// 첫 단계는 **로스터리와 원두를 같이 찾는다.** "이미 누군가 등록해두지 않았을까?" 가
// 동기라 로스터리를 먼저 고르게 하는 것이 헛걸음이 되는 경우가 많다.
//
// 두 단계가 없어지는 것이 아니라 **맞았을 때만 건너뛴다.** `Product.vendorId` 가 FK 필수라
// 로스터리 없이는 원두를 만들 수 없고, 결과가 없으면 여전히 로스터리부터 물어야 한다.
function SearchStep({ onPickVendor }: { onPickVendor: (v: VendorHit) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [vendors, setVendors] = useState<VendorHit[]>([]);
  const [products, setProducts] = useState<ProductGlobalHit[]>([]);
  const [pending, startTransition] = useTransition();
  const debounced = useDebounced(query, 200);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    let cancelled = false;
    // 짧은 질의는 요청도 안 보낸다. 한 글자는 트라이그램 조각이 몇 개 안 돼 후보를
    // 못 좁힌다 — 인덱스가 걸러줄 것이 없어 similarity 계산이 행 수만큼 돈다.
    // **결과를 지우지도 않는다** — 지운 상태를 effect 안에서 만들면 렌더가 연쇄한다.
    // 안 보이는 것은 아래 파생값이 정한다
    if (debounced.trim().length < MIN_QUERY_LENGTH) return;
    Promise.all([searchVendors(debounced), searchProductsGlobal(debounced)]).then(([v, p]) => {
      if (cancelled) return;
      setVendors(v);
      setProducts(p);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const trimmed = query.trim();
  // 지우고 나면 직전 검색 결과가 남아 있어도 안 보인다. 상태가 아니라 파생값이다
  const enough = trimmed.length >= MIN_QUERY_LENGTH;
  const shownVendors = enough ? vendors : [];
  const shownProducts = enough ? products : [];
  const exactVendor = shownVendors.some((h) => h.name === trimmed);

  return (
    <div className="flex-1 overflow-y-auto px-4">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="로스터리 · 원두 검색"
        className="h-12 w-full rounded-[10px] bg-surface-sunken px-[14px] text-[16px] text-ink outline-none placeholder:text-muted-soft focus:ring-3 focus:ring-accent-tint"
      />

      {/* 원두를 위에 둔다 — 로스터리를 건너뛰려고 여기 온 것이다.
          두 목록을 점수로 섞지 않는다. similarity 를 다른 테이블 사이에서 비교할 근거가
          없고, 무엇보다 **탭했을 때 가는 곳이 다르다** */}
      {shownProducts.length > 0 && (
        <section className="mt-4">
          <h2 className="text-[12px] text-muted-soft">원두</h2>
          <ul>
            {shownProducts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  // 검색에서 고르는 것은 이미 명시적 선택이다. 확인을 또 묻지 않는다 (설계 7-2)
                  onClick={() => router.push(`/products/${p.id}/record`)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-hairline-soft py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] text-ink">{p.name}</span>
                    {/* 원두 이름은 전역 유일하지 않다. 로스터리명이 없으면 어느 것인지 못 고른다 */}
                    <span className="mt-0.5 block text-[13px] text-muted">
                      {p.vendorName} · 노트 {p.noteCount}개
                    </span>
                  </span>
                  {p.hasRecord && (
                    <span className="shrink-0 text-[12px] text-muted-soft">기록 있음</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {shownVendors.length > 0 && (
        <section className="mt-4">
          <h2 className="text-[12px] text-muted-soft">로스터리</h2>
          <ul>
            {shownVendors.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onPickVendor(v)}
                  className="flex min-h-14 w-full items-center justify-between border-b border-hairline-soft py-3 text-left"
                >
                  <span className="text-[17px] text-ink">{v.name}</span>
                  {v.status === "PENDING" && (
                    <span className="text-[12px] text-pending">승인 대기</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* DB 에 없다는 이유로 기록이 막히면 그날의 기록이 사라진다 (설계 4-8).
          질의가 원두명일 수도 있으므로 무엇을 만드는지 라벨에 박는다 —
          원두는 로스터리를 고른 다음 단계에서 만든다 */}
      {enough && !exactVendor && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              onPickVendor(await createVendor(trimmed));
            })
          }
          className="mt-4 flex min-h-12 w-full items-center rounded-[10px] border border-dashed border-hairline px-[14px] text-left text-[15px] text-ink"
        >
          + 로스터리 “{trimmed}” 추가
        </button>
      )}

      {enough && shownVendors.length === 0 && shownProducts.length === 0 && (
        <p className="mt-6 text-[13px] text-muted">
          찾는 것이 없다. 로스터리를 먼저 만들면 그 안에 원두를 등록할 수 있다.
        </p>
      )}

      {trimmed.length === 0 && (
        <p className="mt-6 text-[13px] text-muted">
          원두 이름으로 바로 찾을 수 있다. 없으면 로스터리부터 만든다.
        </p>
      )}

      {/* 한 글자에서는 검색이 안 나간다. 아무 반응이 없으면 고장으로 읽히므로 이유를 말한다 */}
      {trimmed.length > 0 && !enough && (
        <p className="mt-6 text-[13px] text-muted">{MIN_QUERY_LENGTH}글자 이상 입력한다.</p>
      )}
    </div>
  );
}

function ProductStep({ vendor }: { vendor: VendorHit }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const debounced = useDebounced(query, 200);

  useEffect(() => {
    let cancelled = false;
    searchProducts(vendor.id, debounced).then((r) => !cancelled && setHits(r));
    return () => {
      cancelled = true;
    };
  }, [vendor.id, debounced]);

  const goRegister = () => {
    const q = new URLSearchParams({ vendorId: vendor.id });
    if (query.trim()) q.set("name", query.trim());
    router.push(`/products/new?${q}`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="원두명 검색"
        autoFocus
        className="h-12 w-full shrink-0 rounded-[10px] bg-surface-sunken px-[14px] text-[16px] text-ink outline-none placeholder:text-muted-soft focus:ring-3 focus:ring-accent-tint"
      />

      <div className="flex-1 overflow-y-auto">
        <ul className="mt-2">
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                // 검색에서 고르는 것은 이미 명시적 선택이다. 확인을 또 묻지 않는다 (설계 7-2).
                // 확인 화면은 등록 직후에만 둔다 (요구 FR-4)
                onClick={() => router.push(`/products/${p.id}/record`)}
                className="flex min-h-14 w-full items-center justify-between border-b border-hairline-soft py-3 text-left"
              >
                <span>
                  <span className="block text-[17px] text-ink">{p.name}</span>
                  <span className="block text-[13px] text-muted">노트 {p.noteCount}개</span>
                </span>
                {/* 이미 기록이 있으면 새로 만들지 않고 편집으로 간다 (요구 FR-6) */}
                {p.hasRecord && <span className="text-[12px] text-muted-soft">기록 있음</span>}
              </button>
            </li>
          ))}
        </ul>

        {hits.length === 0 && (
          <p className="mt-6 text-[13px] text-muted">
            {debounced.trim().length > 0
              ? "이 로스터리에 해당 원두가 없다."
              : "이 로스터리에 등록된 원두가 없다."}
          </p>
        )}
      </div>

      {/* 결과가 없을 때 그 화면에서 등록으로 넘어간다 (요구 FR-2).
          여기서부터는 타이핑이 길어 시트가 아니라 라우트다 */}
      <div className="shrink-0 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={goRegister}
          className="h-12 w-full rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed"
        >
          새 원두 등록
        </button>
      </div>
    </div>
  );
}
