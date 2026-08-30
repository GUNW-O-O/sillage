"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  createVendor,
  searchProducts,
  searchVendors,
  type ProductHit,
  type VendorHit,
} from "@/app/actions";

// 흐름은 로스터리 → 원두명 두 단계다 (요구 R1).
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
  const exact = hits.some((h) => h.name === trimmed);

  return (
    <div className="flex-1 overflow-y-auto px-4">
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
              {v.status === "PENDING" && <span className="text-[12px] text-pending">승인 대기</span>}
            </button>
          </li>
        ))}
      </ul>

      {/* DB 에 없다는 이유로 기록이 막히면 그날의 기록이 사라진다 (설계 4-8) */}
      {trimmed.length > 0 && !exact && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              onPick(await createVendor(trimmed));
            })
          }
          className="mt-3 flex min-h-12 w-full items-center rounded-[10px] border border-dashed border-hairline px-[14px] text-left text-[15px] text-ink"
        >
          + “{trimmed}” 추가
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
