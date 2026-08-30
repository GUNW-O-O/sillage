"use client";

import { useState } from "react";

import { ROAST_LEVELS, type CoffeeAttributes } from "@/lib/product-attributes";

import { LookupPicker } from "./lookup-picker";

// 상세를 한 번에 다 펼치지 않는다. 채울 것만 하나씩 꺼낸다 —
// 로스터리마다 공개 수준이 천차만별이라 빈 칸이 대부분인 긴 폼이 되기 쉽다 (설계 4-3).
type FieldKey =
  | "country"
  | "region"
  | "variety"
  | "process"
  | "roastLevel"
  | "agtron"
  | "farm"
  | "producer"
  | "lot";

type FieldDef = { key: FieldKey; label: string; only?: "single" };

const FIELDS: FieldDef[] = [
  { key: "country", label: "나라" },
  { key: "process", label: "가공" },
  { key: "variety", label: "품종" },
  { key: "roastLevel", label: "배전도" },
  { key: "region", label: "지역", only: "single" },
  { key: "farm", label: "농장", only: "single" },
  { key: "producer", label: "프로듀서", only: "single" },
  { key: "lot", label: "로트", only: "single" },
  { key: "agtron", label: "아그트론" },
];

// 가향 · 디카페인은 꺼냈다가 다시 "예"를 누를 값이 아니다. 기본이 false 인 boolean 이라
// 칩 하나를 켜고 끄는 것으로 끝난다 — 필드로 두면 2탭이 되고,
// 첫 화면에 "아니오" 버튼 하나만 떠서 조작처럼 보이지도 않는다.
const FLAGS = [
  { key: "infused", label: "가향" },
  { key: "decaf", label: "디카페인" },
] as const;

export function ProductDetailFields({
  attrs,
  onChange,
}: {
  attrs: CoffeeAttributes;
  onChange: (next: CoffeeAttributes) => void;
}) {
  const [active, setActive] = useState<FieldKey[]>([]);

  const set = <K extends keyof CoffeeAttributes>(k: K, v: CoffeeAttributes[K]) =>
    onChange({ ...attrs, [k]: v });

  const available = FIELDS.filter(
    (f) => !active.includes(f.key) && (!f.only || f.only === attrs.kind),
  );
  const shown = FIELDS.filter(
    (f) => active.includes(f.key) && (!f.only || f.only === attrs.kind),
  );

  const drop = (key: FieldKey) => {
    setActive((a) => a.filter((k) => k !== key));
    // 뺀 필드의 값도 같이 비운다. 화면에 없는데 저장되면 놀란다
    const cleared: Partial<CoffeeAttributes> = {
      country: attrs.kind === "single" ? { countryId: undefined } : { countryIds: [] },
      region: { region: "" },
      variety: { varietyIds: [] },
      process: attrs.kind === "single" ? { processId: undefined } : { processIds: [] },
      roastLevel: { roastLevel: undefined },
      agtron: { agtron: undefined },
      farm: { farm: "" },
      producer: { producer: "" },
      lot: { lot: "" },
    }[key];
    onChange({ ...attrs, ...cleared });
  };

  return (
    <div className="mt-4 space-y-6">
      {/* 구성은 다른 필드의 목록을 바꾸므로 항상 위에 둔다 */}
      <div>
        <div className="mb-2 text-[14px] font-medium text-muted">구성</div>
        <div className="flex gap-2">
          {(["single", "blend"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set("kind", k)}
              className={`inline-flex min-h-11 items-center rounded-full px-[14px] text-[14px] font-medium ${
                attrs.kind === k ? "bg-accent text-on-accent" : "border border-hairline text-body"
              }`}
            >
              {k === "single" ? "싱글 오리진" : "블렌드"}
            </button>
          ))}
        </div>
      </div>

      {shown.map((f) => (
        <div key={f.key}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[14px] font-medium text-muted">
              {f.label}
              {attrs.kind === "blend" && (f.key === "country" || f.key === "process") && " (복수)"}
            </span>
            <button
              type="button"
              onClick={() => drop(f.key)}
              className="flex h-11 items-center px-2 text-[13px] text-muted-soft"
            >
              빼기
            </button>
          </div>
          <FieldBody fieldKey={f.key} attrs={attrs} set={set} />
        </div>
      ))}

      <div>
        <div className="mb-2 text-[14px] font-medium text-muted">표시</div>
        <div className="flex flex-wrap gap-2">
          {FLAGS.map((f) => {
            const on = f.key === "infused" ? attrs.infused : !!attrs.decaf;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() =>
                  f.key === "infused" ? set("infused", !on) : set("decaf", !on)
                }
                className={`inline-flex min-h-11 items-center rounded-full px-[14px] text-[14px] font-medium ${
                  on ? "bg-accent text-on-accent" : "border border-hairline text-body"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {available.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] text-muted">아는 것만 골라 채운다</div>
          <div className="flex flex-wrap gap-2">
            {available.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setActive((a) => [...a, f.key])}
                className="inline-flex min-h-11 items-center rounded-full border border-dashed border-hairline px-[14px] text-[14px] text-body"
              >
                + {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldBody({
  fieldKey,
  attrs,
  set,
}: {
  fieldKey: FieldKey;
  attrs: CoffeeAttributes;
  set: <K extends keyof CoffeeAttributes>(k: K, v: CoffeeAttributes[K]) => void;
}) {
  const blend = attrs.kind === "blend";

  switch (fieldKey) {
    case "country":
      return (
        <LookupPicker
          kind="COUNTRY"
          label=""
          multiple={blend}
          selected={blend ? (attrs.countryIds ?? []) : attrs.countryId ? [attrs.countryId] : []}
          onChange={(ids) => (blend ? set("countryIds", ids) : set("countryId", ids[0]))}
        />
      );
    case "process":
      // 블렌드는 구성 원두마다 가공이 다를 수 있다 — 워시드 + 내추럴이 흔하다
      return (
        <LookupPicker
          kind="PROCESS"
          label=""
          multiple={blend}
          selected={blend ? (attrs.processIds ?? []) : attrs.processId ? [attrs.processId] : []}
          onChange={(ids) => (blend ? set("processIds", ids) : set("processId", ids[0]))}
        />
      );
    case "variety":
      return (
        <LookupPicker
          kind="VARIETY"
          label=""
          multiple
          selected={attrs.varietyIds}
          onChange={(ids) => set("varietyIds", ids)}
        />
      );
    case "roastLevel":
      return (
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
      );
    case "agtron":
      return (
        <Text
          value={attrs.agtron?.toString() ?? ""}
          inputMode="numeric"
          onChange={(v) => set("agtron", v ? Number(v) : undefined)}
        />
      );
    default: {
      const k = fieldKey as "region" | "farm" | "producer" | "lot";
      return <Text value={attrs[k] ?? ""} onChange={(v) => set(k, v)} />;
    }
  }
}

function Text({
  value,
  onChange,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric";
}) {
  return (
    <input
      value={value}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-[10px] bg-surface-sunken px-[14px] text-[16px] text-ink outline-none focus:ring-3 focus:ring-accent-tint"
    />
  );
}
