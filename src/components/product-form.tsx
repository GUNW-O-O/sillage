"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createProduct, type NoteInput } from "@/app/actions";
import {
  EMPTY_COFFEE_ATTRIBUTES,
  pruneAttributes,
  ROAST_LEVELS,
  type CoffeeAttributes,
} from "@/lib/product-attributes";

import { LookupPicker } from "./lookup-picker";
import { NoteChips } from "./note-input";

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

  const set = <K extends keyof CoffeeAttributes>(k: K, v: CoffeeAttributes[K]) =>
    setAttrs((a) => ({ ...a, [k]: v }));

  // 필수 셋을 넘기면 바로 저장할 수 있다. 나머지는 전부 선택이다 (설계 7-1)
  const ready = name.trim().length > 0 && notes.length > 0;

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
    <div className="pb-32">
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
          나라 · 가공을 채우면 나중에 그룹별 비교에 나타난다.
        </p>
      )}

      {detailOpen && (
        <div className="mt-4 space-y-6">
          <Field label="구성">
            <div className="flex gap-2">
              {(["single", "blend"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set("kind", k)}
                  className={`inline-flex min-h-11 items-center rounded-full px-[14px] text-[14px] font-medium ${
                    attrs.kind === k
                      ? "bg-accent text-on-accent"
                      : "border border-hairline text-body"
                  }`}
                >
                  {k === "single" ? "싱글 오리진" : "블렌드"}
                </button>
              ))}
            </div>
          </Field>

          <LookupPicker
            kind="COUNTRY"
            label={attrs.kind === "single" ? "나라" : "나라 (복수)"}
            multiple={attrs.kind === "blend"}
            selected={
              attrs.kind === "single"
                ? attrs.countryId
                  ? [attrs.countryId]
                  : []
                : (attrs.countryIds ?? [])
            }
            onChange={(ids) =>
              attrs.kind === "single" ? set("countryId", ids[0]) : set("countryIds", ids)
            }
          />

          {/* 블렌드는 지역 · 농장 · 프로듀서 · 로트를 아예 묻지 않는다 (설계 4-3) */}
          {attrs.kind === "single" && (
            <>
              <Field label="지역">
                <TextInput
                  value={attrs.region ?? ""}
                  onChange={(v) => set("region", v)}
                  placeholder="예: 구지, 예가체페"
                />
              </Field>
              <div className="grid gap-4">
                <Field label="농장">
                  <TextInput value={attrs.farm ?? ""} onChange={(v) => set("farm", v)} />
                </Field>
                <Field label="프로듀서">
                  <TextInput value={attrs.producer ?? ""} onChange={(v) => set("producer", v)} />
                </Field>
                <Field label="로트">
                  <TextInput value={attrs.lot ?? ""} onChange={(v) => set("lot", v)} />
                </Field>
              </div>
            </>
          )}

          <LookupPicker
            kind="VARIETY"
            label="품종 (복수)"
            multiple
            selected={attrs.varietyIds}
            onChange={(ids) => set("varietyIds", ids)}
          />

          <LookupPicker
            kind="PROCESS"
            label="가공방식"
            selected={attrs.processId ? [attrs.processId] : []}
            onChange={(ids) => set("processId", ids[0])}
          />

          <Field label="배전도">
            <div className="flex flex-wrap gap-2">
              {ROAST_LEVELS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set("roastLevel", attrs.roastLevel === r.value ? undefined : r.value)}
                  className={`inline-flex min-h-11 items-center rounded-full px-[14px] text-[14px] font-medium ${
                    attrs.roastLevel === r.value
                      ? "bg-accent text-on-accent"
                      : "border border-hairline text-body"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="아그트론">
            <TextInput
              value={attrs.agtron?.toString() ?? ""}
              onChange={(v) => set("agtron", v ? Number(v) : undefined)}
              placeholder="숫자"
              inputMode="numeric"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            {/* 가향은 가공방식과 분리한다 — 추천이 걸러내야 한다 (설계 4-3) */}
            <Toggle on={attrs.infused} onClick={() => set("infused", !attrs.infused)} label="가향" />
            {/* 디카페인은 가공 축이 아니라 처리다. 워시드이면서 디카페인일 수 있다 */}
            <Toggle on={!!attrs.decaf} onClick={() => set("decaf", !attrs.decaf)} label="디카페인" />
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}

      {duplicate && (
        <div className="mt-4 rounded-[10px] border border-hairline bg-surface-card p-4">
          <p className="text-[15px] text-ink">
            같은 로스터리에 같은 이름 · 같은 노트 집합의 원두가 이미 있다.
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
          <button
            type="button"
            disabled={!ready || pending}
            onClick={submit}
            className="h-12 w-full rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed disabled:bg-cta-disabled"
          >
            {pending ? "저장 중" : "등록하고 기록하기"}
          </button>
          {!ready && (
            <p className="mt-2 text-center text-[12px] text-muted">
              제품명과 노트 1개만 있으면 저장된다
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

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric";
}) {
  return (
    <input
      value={value}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-[10px] bg-surface-sunken px-[14px] text-[16px] text-ink outline-none placeholder:text-muted-soft focus:ring-3 focus:ring-accent-tint"
    />
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center rounded-full px-[14px] text-[14px] font-medium ${
        on ? "bg-accent text-on-accent" : "border border-hairline text-body"
      }`}
    >
      {label}
    </button>
  );
}
