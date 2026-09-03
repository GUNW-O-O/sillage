"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createProduct, type NoteInput } from "@/app/actions";
import {
  EMPTY_COFFEE_ATTRIBUTES,
  pruneAttributes,
  type CoffeeAttributes,
} from "@/lib/product-attributes";

import { NoteChips } from "./note-input";
import { ProductDetailFields } from "./product-detail-fields";

type Duplicate = { productId: string; productName: string };

export function ProductForm({
  vendorId,
  vendorName,
  initialName,
}: {
  vendorId: string;
  vendorName: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState<NoteInput[]>([]);
  const [attrs, setAttrs] = useState<CoffeeAttributes>(EMPTY_COFFEE_ATTRIBUTES);
  const [detailOpen, setDetailOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [pending, startTransition] = useTransition();

  // 필수 셋을 넘기면 바로 저장할 수 있다. 나머지는 전부 선택이다 (설계 7-1)
  const ready = name.trim().length > 0 && notes.length > 0;

  // 이 화면이 시트가 아니라 라우트인 이유가 **타이핑이 길어 잃으면 손해가 크다**는 것이다.
  // 그러니 취소도 한 탭에 버리게 두지 않는다. 아무것도 안 친 상태면 묻지 않는다 —
  // 잘못 들어온 것을 나가는 데 확인을 요구하면 그것대로 방해다
  const dirty =
    name.trim() !== initialName.trim() ||
    notes.length > 0 ||
    JSON.stringify(pruneAttributes(attrs)) !== JSON.stringify(pruneAttributes(EMPTY_COFFEE_ATTRIBUTES));

  const cancel = () => {
    if (dirty && !confirm("입력한 것을 버리고 나갈까요?")) return;
    // 여기까지 온 경로는 시트였고 그 상태는 이미 사라졌다. 목록이 정직한 도착지다
    router.push("/");
  };

  const submit = () =>
    startTransition(async () => {
      setError(null);
      setDuplicate(null);
      const result = await createProduct({
        vendorId,
        name,
        notes,
        attributes: pruneAttributes(attrs),
      });
      if (result.ok) {
        // 등록과 기록은 끊기지 않는다 (요구 FR-4)
        router.push(`/products/${result.productId}/confirm`);
      } else if (result.reason === "duplicate") {
        setDuplicate({ productId: result.productId, productName: result.productName });
      } else {
        setError(result.message);
      }
    });

  return (
    <div className="pb-40">
      <div className="mb-3 flex min-h-14 items-center rounded-[10px] bg-surface-card px-4">
        <span>
          <span className="block text-[12px] text-muted">로스터리</span>
          <span className="block text-[17px] font-semibold text-ink">{vendorName}</span>
        </span>
      </div>

      <Field label="제품명">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="봉투에 적힌 그대로"
          className="h-12 w-full rounded-[10px] bg-surface-sunken px-[14px] text-[16px] text-ink outline-none placeholder:text-muted-soft focus:ring-3 focus:ring-accent-tint"
        />
      </Field>

      <Field label="판매자 노트">
        <NoteChips notes={notes} onChange={setNotes} />
      </Field>

      {/* 접힌 필드를 강제하지 않는 대신 채우면 얻는 것을 보여준다 (설계 7-1) */}
      <button
        type="button"
        onClick={() => setDetailOpen((o) => !o)}
        className="mt-6 flex min-h-12 w-full items-center justify-between rounded-[10px] bg-surface-card px-4 text-[14px] font-medium text-body"
      >
        <span>상세 정보</span>
        <span className="text-muted">{detailOpen ? "▲" : "▼"}</span>
      </button>
      {!detailOpen && (
        <p className="mt-2 text-[13px] text-muted">
          나라 · 가공을 채우면 나중에 그룹별 비교에 나와요. 아는 것만 채워도 돼요.
        </p>
      )}

      {detailOpen && <ProductDetailFields attrs={attrs} onChange={setAttrs} />}

      {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}

      {duplicate && (
        <div className="mt-4 rounded-[10px] border border-hairline bg-surface-card p-4">
          <p className="text-[15px] text-ink">
            같은 로스터리에 같은 이름 · 같은 노트의 원두가 이미 있어요.
          </p>
          <p className="mt-1 text-[13px] text-muted">{duplicate.productName}</p>
          <button
            type="button"
            onClick={() => router.push(`/products/${duplicate.productId}/confirm`)}
            className="mt-3 h-12 w-full rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed"
          >
            그 원두에 기록 붙이기
          </button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface-raised">
        <div className="mx-auto w-full max-w-[560px] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          {/* 한 행. 취소를 CTA 아래에 쌓으면 바가 높아져 폼이 그만큼 가린다.
              폭으로 위계를 준다 — 취소는 필요한 만큼만, 저장이 나머지를 다 쓴다 */}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={cancel}
              className="h-12 shrink-0 rounded-[10px] border border-hairline bg-canvas px-5 text-[15px] text-ink"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!ready || pending}
              onClick={submit}
              className="h-12 flex-1 rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed disabled:bg-cta-disabled"
            >
              {pending ? "저장 중" : "등록하고 기록하기"}
            </button>
          </div>
          {!ready && (
            <p className="mt-2 text-center text-[12px] text-muted">
              제품명과 노트 1개만 있으면 저장돼요
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-[14px] font-medium text-muted">{label}</div>
      {children}
    </div>
  );
}
