"use client";

import type { NoteInput } from "@/app/actions";

import { NoteChips } from "./note-input";

// 판매자가 안 적었는데 내가 느낀 향 (`ExtraNote`).
//
// **판정을 붙이지 않는다.** 4상태 순환은 판매자의 주장에 대한 대조라 좌변이 있어야
// 성립한다 — 판매자가 안 적은 향은 대조할 주장이 없고, 적었다는 사실 자체가 값이다.
// 그래서 판매자 노트와 같은 칩 모양을 쓰지 않는다. 나란히 두면 판정으로 오해된다.
export function ExtraNotes({
  notes,
  onChange,
  editable,
}: {
  notes: NoteInput[];
  onChange?: (next: NoteInput[]) => void;
  editable: boolean;
}) {
  return (
    <section className="mt-8">
      <h3 className="text-[15px] font-semibold text-ink">내가 느낀 향</h3>
      <p className="mt-1 text-[13px] text-muted">
        판매자가 안 적었는데 느낀 것만 적어 주세요. 위 노트를 더 잘게 쪼개는 자리가 아니에요.
      </p>

      {editable && onChange ? (
        <div className="mt-3">
          <NoteChips notes={notes} onChange={onChange} placeholder="느낀 향을 하나씩" />
        </div>
      ) : notes.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {notes.map((n) => (
            <li
              key={n.raw}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-[14px] text-[14px] font-medium ${
                n.nodeId ? "bg-surface-card text-ink" : "border border-dashed border-pending text-body"
              }`}
            >
              {n.raw}
              {/* 축이 안 붙었다. 기록은 남지만 집계에는 안 들어간다 — 어드민이 붙인다 */}
              {!n.nodeId && <span className="text-[11px] text-pending">미매핑</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-muted-soft">적은 것이 없어요.</p>
      )}
    </section>
  );
}
