"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  createLookup,
  getLookupsByIds,
  searchLookups,
  type LookupOption,
} from "@/app/actions";
import { normalizeName } from "@/lib/normalize";
import { createSelectionResolver, type Resolver } from "@/lib/selection-resolver";

// lookup 에 값이 없다는 이유로 기록이 막히면 안 된다 (설계 4-8).
// country 만 닫힌 집합이라 추가를 막는다.
/// 무엇을 고르는 피커인지. **셋이 한 화면에 나란히 서는데 이름이 없었다** —
/// placeholder 가 전부 " 검색" 이라 스크린리더로도 구분이 안 되고, 화면의 「나라 · 가공 ·
/// 품종」 은 피커 바깥에 있어 입력과 안 이어졌다. kind 가 곧 무엇을 고르는지다.
const KIND_NAME = { COUNTRY: "나라", PROCESS: "가공", VARIETY: "품종" } as const;

export function LookupPicker({
  kind,
  multiple,
  selected,
  onChange,
}: {
  kind: "COUNTRY" | "VARIETY" | "PROCESS";
  multiple?: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const name = KIND_NAME[kind];
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LookupOption[]>([]);
  // 이름을 아는 lookup. 이번 화면에서 고른 것과, 들어올 때 이미 선택돼 있던 것
  const [chosen, setChosen] = useState<LookupOption[]>([]);
  const [pending, startTransition] = useTransition();

  // 수정 화면은 selected 에 id 를 들고 시작한다. 이름을 모르면 선택 칩이 안 그려지고
  // visible 이 selected 를 걸러내므로 후보 목록에서도 빠져 **통째로 사라진 것처럼 보인다.**
  // 등록 폼에서만 쓰던 때는 selected 가 늘 비어 있어 안 드러났다.
  //
  // 절차와 그 함정은 selection-resolver.ts 에 있고 테스트가 지킨다.
  // selected 는 렌더마다 새 배열이라 이 effect 는 매 렌더 돈다 — 리졸버가 이미 물어본
  // id 를 기억하므로 첫 회 이후로는 즉시 빠져나간다
  const resolve = useRef<Resolver>(null);
  resolve.current ??= createSelectionResolver(getLookupsByIds, (rows) =>
    setChosen((c) => [...c, ...rows.filter((r) => !c.some((x) => x.id === r.id))]),
  );
  useEffect(() => {
    resolve.current?.(selected);
  }, [selected]);

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
  // **한글 이름만 보면 안 된다.** "Geisha" 를 치면 게이샤가 목록에 뜨는데도 이름이
  // 안 같아서 「추가」가 나란히 떴고, 그걸 눌러 같은 품종이 두 행이 됐다.
  // 서버도 같은 규칙으로 막지만(`createLookup`), 버튼이 안 뜨는 편이 덜 헷갈린다.
  // 별칭까지는 안 본다 — 옵션마다 별칭을 실어 나르는 값이 매 타이핑마다 오간다.
  // 그 경우는 눌러도 서버가 기존 행을 돌려주므로 데이터가 갈리지 않는다
  const normalizedQuery = normalizeName(trimmed);
  const exact = options.some(
    (o) =>
      normalizeName(o.nameKo) === normalizedQuery ||
      (o.nameEn != null && normalizeName(o.nameEn) === normalizedQuery),
  );
  const canAdd = kind !== "COUNTRY" && normalizedQuery.length > 0 && !exact;

  // 선택된 것은 목록 위에 항상 보인다
  const selectedOptions = chosen.filter((c) => selected.includes(c.id));
  const visible = options.filter((o) => !selected.includes(o.id)).slice(0, 12);

  return (
    <div>
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
        aria-label={`${name} 검색`}
        placeholder={`${name} 검색`}
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
              {/* **검색 결과에서만 영문을 같이 보여준다** — "Geisha" 를 쳤을 때
                  왜 이 항목이 떴는지가 보여야 옆의 「추가」를 안 누른다.
                  고른 뒤의 칩에는 안 붙인다: 폰 폭에서 칩 하나가 줄을 다 먹는다 */}
              {o.nameEn && <span className="text-[12px] text-muted">· {o.nameEn}</span>}
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
          <span className="ml-2 text-[12px] text-muted">승인 대기로 들어가요</span>
        </button>
      )}
    </div>
  );
}
