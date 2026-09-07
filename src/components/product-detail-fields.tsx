"use client";

import { useMemo, useState } from "react";

import { revealCount } from "@/lib/detail-field-reveal";
import { ROAST_LEVELS, type CoffeeAttributes } from "@/lib/product-attributes";

import { LookupPicker } from "./lookup-picker";

// 상세를 한 번에 다 펼치지 않는다. **순서대로 하나씩 나온다** —
// 채우면 다음 칸이 뜨고, 모르면 건너뛴다.
// 로스터리마다 공개 수준이 천차만별이라 빈 칸이 대부분인 긴 폼이 되기 쉽다 (설계 4-3).
type FieldKey =
  | "country"
  | "process"
  | "variety"
  | "roastLevel"
  | "region"
  | "farm"
  | "producer"
  | "lot"
  | "agtron";

type FieldDef = { key: FieldKey; label: string; only?: "single" };

// 순서가 곧 입력 순서다. 봉투에서 눈에 먼저 들어오는 것부터.
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
// 칩 하나를 켜고 끄면 끝난다.
const FLAGS = [
  { key: "infused", label: "가향" },
  { key: "decaf", label: "디카페인" },
] as const;

function hasValue(key: FieldKey, a: CoffeeAttributes): boolean {
  const blend = a.kind === "blend";
  switch (key) {
    case "country":
      return blend ? (a.countryIds?.length ?? 0) > 0 : !!a.countryId;
    case "process":
      return blend ? (a.processIds?.length ?? 0) > 0 : !!a.processId;
    case "variety":
      return a.varietyIds.length > 0;
    case "roastLevel":
      return !!a.roastLevel;
    case "agtron":
      return typeof a.agtron === "number" && !Number.isNaN(a.agtron);
    default:
      return !!a[key as "region" | "farm" | "producer" | "lot"]?.trim();
  }
}

export function ProductDetailFields({
  attrs,
  onChange,
  revealAll = false,
}: {
  attrs: CoffeeAttributes;
  onChange: (next: CoffeeAttributes) => void;
  /// 수정 화면은 순차 노출을 쓰지 않는다. 등록은 "무엇을 물어볼지 모르는" 상태라
  /// 하나씩 꺼내는 것이 맞지만, 수정은 **어디가 틀렸는지 알고 들어온다** —
  /// 건너뛴 빈 칸에서 노출이 멈추면 그 칸을 영영 못 고친다
  revealAll?: boolean;
}) {
  // 건너뛰기로 사람이 올린 하한. **자동으로 열리는 부분은 상태가 아니다** —
  // 채워진 칸 수에서 그때그때 나오는 값이라 effect 로 밀어 올리면 렌더가 연쇄한다
  const [floor, setFloor] = useState(1);

  const set = <K extends keyof CoffeeAttributes>(k: K, v: CoffeeAttributes[K]) =>
    onChange({ ...attrs, [k]: v });

  // 구성이 바뀌면 해당 없는 칸이 목록에서 빠진다
  const applicable = useMemo(
    () => FIELDS.filter((f) => !f.only || f.only === attrs.kind),
    [attrs.kind],
  );

  // 몇 칸을 열지는 채워진 칸에서 나온다. 규칙은 lib 에 있고 테스트가 지킨다
  const revealed = useMemo(
    () => revealCount(applicable.map((f) => hasValue(f.key, attrs)), floor),
    [applicable, attrs, floor],
  );

  const shown = revealAll ? applicable : applicable.slice(0, revealed);
  const remaining = revealAll ? 0 : applicable.length - revealed;

  // 건너뛰면 그 칸은 공란으로 남고 다음 칸이 나온다. 나중에 채우고 싶으면 그냥 채운다
  const skip = () => setFloor(Math.min(revealed + 1, applicable.length));

  return (
    <div className="mt-4 space-y-6">
      {/* 구성은 이후 칸의 목록을 바꾸므로 항상 위에 둔다 */}
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
            {/* 건너뛰기는 순차 노출의 조작이다. 전부 펼친 수정 화면에는 넘길 다음 칸이 없다 */}
            {!revealAll && (
              <button
                type="button"
                onClick={skip}
                className="flex h-11 items-center px-2 text-[13px] text-muted-soft"
              >
                건너뛰기
              </button>
            )}
          </div>
          <FieldBody fieldKey={f.key} attrs={attrs} set={set} />
        </div>
      ))}

      {remaining > 0 && (
        <p className="text-[13px] text-muted">
          채우면 다음 항목이 나와요. 모르면 건너뛰어도 돼요. {remaining}개 남았어요
        </p>
      )}

      <div>
        <div className="mb-2 text-[14px] font-medium text-muted">표시</div>
        <div className="flex flex-wrap gap-2">
          {FLAGS.map((f) => {
            const on = f.key === "infused" ? attrs.infused : !!attrs.decaf;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => (f.key === "infused" ? set("infused", !on) : set("decaf", !on))}
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
          multiple={blend}
          selected={blend ? (attrs.processIds ?? []) : attrs.processId ? [attrs.processId] : []}
          onChange={(ids) => (blend ? set("processIds", ids) : set("processId", ids[0]))}
        />
      );
    case "variety":
      return (
        <LookupPicker
          kind="VARIETY"
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
