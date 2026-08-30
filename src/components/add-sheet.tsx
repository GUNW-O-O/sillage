"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { createVendor, searchProducts, searchVendors, type ProductHit, type VendorHit } from "@/app/actions";

// 흐름은 로스터리 → 원두명 두 단계다 (요구 R1).
// 로스터리를 아는지가 흐름을 막지 않는 이유는, 컵노트가 없는 커피는 애초에 대상이
// 아니기 때문이다 — 판매자가 없으면 대조할 주장도 없다.
type Step = "vendor" | "product";

export function AddSheet({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("vendor");
  const [vendor, setVendor] = useState<VendorHit | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-hairline bg-surface-raised px-2">
        <button
          type="button"
          onClick={() => (step === "product" ? (setStep("vendor"), setVendor(null)) : onClose())}
          className="flex h-11 min-w-11 items-center justify-center rounded-[10px] px-3 text-[15px] text-muted"
        >
          {step === "product" ? "뒤로" : "닫기"}
        </button>
        <div className="flex-1 text-center text-[15px] font-semibold text-ink">
          {step === "vendor" ? "로스터리" : vendor?.name}
        </div>
        <div className="h-11 min-w-11" />
      </header>

      {step === "vendor" ? (
        <VendorStep
          onPick={(v) => {
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

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function VendorStep({ onPick }: { onPick: (v: VendorHit) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<VendorHit[]>([]);
  const [pending, startTransition] = useTransition();
  const debounced = useDebounced(query, 200);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length === 0) {
      setHits([]);
      return;
    }
    searchVendors(debounced).then((r) => !cancelled && setHits(r));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const trimmed = query.trim();
  // 정확히 같은 이름이 이미 있으면 "추가" 줄을 띄우지 않는다
  const exact = hits.some((h) => h.name === trimmed);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="로스터리 검색"
        className="h-12 w-full rounded-[10px] bg-surface-sunken px-[14px] text-[16px] text-ink outline-none placeholder:text-muted-soft focus:ring-3 focus:ring-accent-tint"
      />

      <ul className="mt-2">
        {hits.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onPick(v)}
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

      {trimmed.length > 0 && !exact && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const v = await createVendor(trimmed);
              onPick(v);
            })
          }
          className="mt-3 flex min-h-12 w-full items-center rounded-[10px] border border-dashed border-hairline px-[14px] text-left text-[15px] text-muted"
        >
          <span className="text-ink">+ “{trimmed}” 추가</span>
        </button>
      )}

      {trimmed.length === 0 && (
        <p className="mt-6 text-[13px] text-muted">
          기록은 로스터리를 고르는 것에서 시작한다. 없으면 그 자리에서 추가한다.
        </p>
      )}
    </div>
  );
}

function ProductStep({ vendor }: { vendor: VendorHit }) {
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

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="원두명 검색"
        autoFocus
        className="h-12 w-full rounded-[10px] bg-surface-sunken px-[14px] text-[16px] text-ink outline-none placeholder:text-muted-soft focus:ring-3 focus:ring-accent-tint"
      />

      <ul className="mt-2">
        {hits.map((p) => (
          <li key={p.id}>
            <button
              type="button"
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

      {/* 결과가 없을 때 그 화면에서 등록으로 넘어간다 (요구 FR-2) */}
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed"
      >
        새 원두 등록
      </button>
    </div>
  );
}
