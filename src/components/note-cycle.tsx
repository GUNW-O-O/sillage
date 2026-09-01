"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { deleteRecord, saveRecord, type NoteHitValueInput, type NoteInput } from "@/app/actions";

import { ExtraNotes } from "./extra-notes";

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
  initialExtra,
  hasRecord,
}: {
  productId: string;
  notes: NoteRow[];
  initial: Record<string, NoteHitValueInput>;
  initialExtra: NoteInput[];
  hasRecord: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, NoteHitValueInput>>(() =>
    Object.fromEntries(notes.map((n) => [n.id, initial[n.id] ?? "MISS"])),
  );
  const [extra, setExtra] = useState<NoteInput[]>(initialExtra);
  const [pending, startTransition] = useTransition();

  // 1탭 순환. `강함` 다음은 `못 느낌` 으로 돌아온다 — 순환 자체가 되돌리는 경로다
  const cycle = (id: string) =>
    setValues((v) => {
      const next = CYCLE[(CYCLE.indexOf(v[id]) + 1) % CYCLE.length];
      return { ...v, [id]: next };
    });

  // "몇 개 찍었나"를 진행률로 보여주지 않는다 — 안 건드린 것이 곧 `못 느낌` 이라
  // 미입력이 아니다. 대신 지금 판정이 어떻게 갈렸는지를 그대로 보여준다
  const summary = useMemo(() => {
    const counts = { STRONG: 0, WEAK: 0, UNSURE: 0, MISS: 0 };
    for (const n of notes) counts[values[n.id]] += 1;
    return counts;
  }, [notes, values]);

  const save = () =>
    startTransition(async () => {
      await saveRecord(
        productId,
        notes.map((n) => ({ sellerNoteId: n.id, value: values[n.id] })),
        extra,
      );
      router.push("/");
    });

  const remove = () =>
    startTransition(async () => {
      if (!confirm("이 기록을 지운다. 판정이 함께 사라진다.")) return;
      await deleteRecord(productId);
      router.push("/");
    });

  return (
    <div className="pb-40">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold text-ink">판매자 노트 {notes.length}개</h2>
        <span className="tabular text-[12px] text-muted">
          강함 {summary.STRONG} · 약함 {summary.WEAK} · 모르겠음 {summary.UNSURE} · 못 느낌{" "}
          {summary.MISS}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted">
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
                className={`inline-flex min-h-14 min-w-[92px] flex-col items-start justify-center rounded-[14px] px-4 py-2 text-left ${s.cls}`}
              >
                <span className="flex items-center gap-1.5 text-[16px] font-medium">
                  {n.raw}
                  {/* 아직 축이 안 붙은 노트. 판정은 되지만 집계에는 안 들어간다 */}
                  {!n.nodeId && (
                    <span className="rounded-full border border-current px-1 text-[10px] opacity-60">
                      미분류
                    </span>
                  )}
                </span>
                {/* 색만으로 상태를 표현하지 않는다 */}
                <span className="mt-0.5 text-[12px] opacity-80">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <ExtraNotes notes={extra} onChange={setExtra} editable />

      <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface-raised">
        <div className="mx-auto w-full max-w-[560px] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="h-12 w-full rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed disabled:bg-cta-disabled"
          >
            {pending ? "저장 중" : hasRecord ? "기록 고치기" : "기록 저장"}
          </button>
          {hasRecord && (
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="mt-1 h-11 w-full text-[14px] text-danger"
            >
              기록 삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
