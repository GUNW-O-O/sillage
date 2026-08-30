"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteRecord, saveRecord, type NoteHitValueInput } from "@/app/actions";

// 4상태 순환 (설계 4-5).
// 미선택 상태를 두지 않는다 — 안 건드린 것이 곧 `못 느낌` 이다.
// 느꼈으면 그 노트를 건드리게 되고, 못 느꼈으면 건드릴 이유가 없다.
const CYCLE: NoteHitValueInput[] = ["MISS", "UNSURE", "WEAK", "STRONG"];

// 채움이 점점 진해진다 — 빈 것 → 회색 채움 → 연한 강조 → 진한 강조.
// 값의 순서가 시각적 무게와 일치하므로 순환 방향이 몸에 붙는다.
const STYLE: Record<NoteHitValueInput, { label: string; cls: string }> = {
  MISS: { label: "못 느낌", cls: "border border-hairline text-muted-soft" },
  UNSURE: { label: "모르겠음", cls: "bg-surface-sunken text-muted" },
  WEAK: { label: "약함", cls: "bg-accent-tint text-accent-pressed" },
  STRONG: { label: "강함", cls: "bg-accent text-on-accent" },
};

export type NoteRow = { id: string; raw: string; nodeId: string | null };

export function NoteCycle({
  productId,
  notes,
  initial,
  hasRecord,
}: {
  productId: string;
  notes: NoteRow[];
  initial: Record<string, NoteHitValueInput>;
  hasRecord: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, NoteHitValueInput>>(() =>
    Object.fromEntries(notes.map((n) => [n.id, initial[n.id] ?? "MISS"])),
  );
  const [pending, startTransition] = useTransition();

  // 1탭 순환. `강함` 다음은 `못 느낌` 으로 돌아온다 — 순환 자체가 되돌리는 경로다
  const cycle = (id: string) =>
    setValues((v) => {
      const next = CYCLE[(CYCLE.indexOf(v[id]) + 1) % CYCLE.length];
      return { ...v, [id]: next };
    });

  const save = () =>
    startTransition(async () => {
      await saveRecord(
        productId,
        notes.map((n) => ({ sellerNoteId: n.id, value: values[n.id] })),
      );
      router.push("/");
    });

  const remove = () =>
    startTransition(async () => {
      await deleteRecord(productId);
      router.push("/");
    });

  return (
    <div className="pb-32">
      <p className="text-[13px] text-muted">
        느낀 것만 탭한다. 안 건드린 노트는 <span className="text-ink">못 느낌</span> 이다.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {notes.map((n) => {
          const s = STYLE[values[n.id]];
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => cycle(n.id)}
                className={`inline-flex min-h-11 flex-col items-start justify-center rounded-[14px] px-[14px] py-2 text-left ${s.cls}`}
              >
                <span className="text-[15px] font-medium">{n.raw}</span>
                {/* 색만으로 상태를 표현하지 않는다 */}
                <span className="text-[11px] opacity-80">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface-raised">
        <div className="mx-auto w-full max-w-[560px] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="h-12 w-full rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed disabled:bg-cta-disabled"
          >
            {pending ? "저장 중" : "저장"}
          </button>
          {hasRecord && (
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="mt-2 h-12 w-full text-[15px] text-danger"
            >
              기록 삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
