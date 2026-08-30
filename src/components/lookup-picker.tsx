"use client";

import { useEffect, useState, useTransition } from "react";

import { createLookup, searchLookups, type LookupOption } from "@/app/actions";

// lookup 에 값이 없다는 이유로 기록이 막히면 안 된다 (설계 4-8).
// country 만 닫힌 집합이라 추가를 막는다.
export function LookupPicker({
  kind,
  label,
  multiple,
  selected,
  onChange,
}: {
  kind: "COUNTRY" | "VARIETY" | "PROCESS";
  label: string;
  multiple?: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [chosen, setChosen] = useState<LookupOption[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      searchLookups(kind, query).then((r) => !cancelled && setOptions(r));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [kind, query]);

  const pick = (o: LookupOption) => {
    const next = multiple
      ? selected.includes(o.id)
        ? selected.filter((id) => id !== o.id)
        : [...selected, o.id]
      : selected[0] === o.id
        ? []
        : [o.id];
    setChosen((c) => (c.some((x) => x.id === o.id) ? c : [...c, o]));
    onChange(next);
    if (!multiple) setQuery("");
  };

  const trimmed = query.trim();
  const exact = options.some((o) => o.nameKo === trimmed);
  const canAdd = kind !== "COUNTRY" && trimmed.length > 0 && !exact;

  // 선택된 것은 목록 위에 항상 보인다
  const selectedOptions = chosen.filter((c) => selected.includes(c.id));
  const visible = options.filter((o) => !selected.includes(o.id)).slice(0, 12);

  return (
    <div>
      <div className="mb-2 text-[14px] font-medium text-muted">{label}</div>

      {selectedOptions.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {selectedOptions.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => pick(o)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-[14px] text-[14px] font-medium text-on-accent"
              >
                {o.nameKo}
                <span className="opacity-70">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`${label} 검색`}
        className="h-12 w-full rounded-[10px] bg-surface-sunken px-[14px] text-[16px] text-ink outline-none placeholder:text-muted-soft focus:ring-3 focus:ring-accent-tint"
      />

      <ul className="mt-2 flex flex-wrap gap-2">
        {visible.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => pick(o)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline px-[14px] text-[14px] text-body"
            >
              {o.nameKo}
              {o.status === "PENDING" && <span className="text-[11px] text-pending">대기</span>}
            </button>
          </li>
        ))}
      </ul>

      {canAdd && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const created = await createLookup(kind as "VARIETY" | "PROCESS", trimmed);
              setChosen((c) => [...c, created]);
              onChange(multiple ? [...selected, created.id] : [created.id]);
              setQuery("");
            })
          }
          className="mt-2 flex min-h-12 w-full items-center rounded-[10px] border border-dashed border-hairline px-[14px] text-left text-[15px] text-ink"
        >
          + “{trimmed}” 추가
          <span className="ml-2 text-[12px] text-muted">승인 대기로 들어간다</span>
        </button>
      )}
    </div>
  );
}
