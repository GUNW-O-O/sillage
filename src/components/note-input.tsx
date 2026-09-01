"use client";

import { useEffect, useRef, useState } from "react";

import { searchNoteSuggestions, type NoteSuggestion } from "@/app/actions";
import { MIN_QUERY_LENGTH } from "@/lib/search-tuning";
import type { NoteInput } from "@/app/actions";

// 노트 입력이 유일한 진짜 병목이다 (설계 7-1).
// 자동완성이 노드를 제안하고, 매칭이 없으면 raw 만 담아 넘어간다 —
// 등록 폼에서 부모 노드를 지정하게 하지 않는다 (설계 5장).
// 미매핑은 어드민 큐에서 raw 를 모아 보며 붙인다.
export function NoteChips({
  notes,
  onChange,
}: {
  notes: NoteInput[];
  onChange: (next: NoteInput[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NoteSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      // 한 글자로는 트라이그램이 좁힐 것이 없다 — 별칭 테이블 전체가 후보가 된다
      if (query.trim().length < MIN_QUERY_LENGTH) return setSuggestions([]);
      searchNoteSuggestions(query).then((r) => !cancelled && setSuggestions(r));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const add = (note: NoteInput) => {
    const raw = note.raw.trim();
    if (!raw) return;
    if (notes.some((n) => n.raw === raw)) return;
    onChange([...notes, { raw, nodeId: note.nodeId }]);
    setQuery("");
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const remove = (raw: string) => onChange(notes.filter((n) => n.raw !== raw));

  return (
    <div>
      {notes.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {notes.map((n) => (
            <li key={n.raw}>
              <button
                type="button"
                onClick={() => remove(n.raw)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-[14px] text-[14px] font-medium ${
                  n.nodeId ? "bg-surface-card text-ink" : "border border-dashed border-pending text-body"
                }`}
              >
                {n.raw}
                {/* 미매핑은 저장을 막지 않는다. 어드민 큐로 간다 */}
                {!n.nodeId && <span className="text-[11px] text-pending">미매핑</span>}
                <span className="text-muted-soft">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // 자동완성에 정확히 같은 표현이 있으면 그 노드를 쓴다
            const hit = suggestions.find((s) => s.raw === query.trim());
            add(hit ? { raw: hit.raw, nodeId: hit.nodeId } : { raw: query, nodeId: null });
          }
        }}
        placeholder="봉투에 적힌 노트를 하나씩"
        className="h-12 w-full rounded-[10px] bg-surface-sunken px-[14px] text-[16px] text-ink outline-none placeholder:text-muted-soft focus:ring-3 focus:ring-accent-tint"
      />

      {suggestions.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-[10px] border border-hairline bg-canvas shadow-[0_2px_8px_rgba(20,20,19,.08)]">
          {suggestions.map((s) => (
            <li key={`${s.raw}-${s.nodeId}`}>
              <button
                type="button"
                onClick={() => add({ raw: s.raw, nodeId: s.nodeId })}
                className="flex min-h-12 w-full items-center justify-between px-4 text-left"
              >
                <span className="text-[16px] text-ink">{s.raw}</span>
                {s.raw !== s.labelKo && (
                  <span className="text-[12px] text-muted">{s.labelKo}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length > 0 && !suggestions.some((s) => s.raw === query.trim()) && (
        <button
          type="button"
          onClick={() => add({ raw: query, nodeId: null })}
          className="mt-1 flex min-h-12 w-full items-center rounded-[10px] border border-dashed border-hairline px-4 text-left text-[15px] text-ink"
        >
          + “{query.trim()}” 그대로 담기
          <span className="ml-2 text-[12px] text-muted">나중에 분류한다</span>
        </button>
      )}
    </div>
  );
}
