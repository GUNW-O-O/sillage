"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  updateProductName,
  updateSellerNote,
  type NoteDistribution,
  type ProductDetail,
} from "@/app/actions";

import { Check, Pencil } from "./icons";

// 여기서 고칠 수 있는 것은 **표기와 제품명**이다.
//
// 표기 수정은 안전하다 — nodeId 가 그대로라 동일성 키도 판정의 좌변도 안 움직인다.
// 그래서 표기가 틀린 노트는 지우는 대신 고쳐서 쓴다 (설계 4-3 개정).
//
// **노트 추가 · 삭제는 어드민 몫이다** (요구 FR-9). 둘 다 noteSetHash 를 움직여
// 다른 원두와 키가 충돌할 수 있고, 충돌하면 막히는데 그때 사용자가 할 수 있는 것이
// 없다 (병합이 없다). 추가는 그 위에 **남이 이미 남긴 기록에 항목을 밀어넣는** 조작이다 —
// 설계 4-3 개정이 안전하다고 한 것은 데이터가 안 깨진다는 뜻이지 남이 내 기록을
// 늘려도 된다는 뜻이 아니었다.
const VERDICT = { STRONG: "강함", WEAK: "약함", UNSURE: "모르겠음", MISS: "못 느낌" } as const;

/// 표본 1일 때 그 한 사람이 무엇을 골랐나
function soleVerdict(counts: NoteDistribution["counts"]): string {
  for (const k of ["STRONG", "WEAK", "UNSURE", "MISS"] as const) {
    if (counts[k] > 0) return VERDICT[k];
  }
  return VERDICT.MISS;
}

export function ProductNotesEditor({
  productId,
  name,
  notes,
  sampleSize,
  peopleExtraNotes,
}: {
  productId: string;
  name: string;
  notes: NoteDistribution[];
  sampleSize: number;
  peopleExtraNotes: ProductDetail["peopleExtraNotes"];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했다");
      else router.refresh();
    });

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-semibold text-ink">판매자 노트 {notes.length}개</h2>
        <button
          type="button"
          onClick={() => {
            setEditing((e) => !e);
            setDraftName(name);
            setError(null);
          }}
          aria-label={editing ? "수정 완료" : "노트 수정"}
          className="-mr-2 flex h-11 w-11 items-center justify-center text-muted"
        >
          {/* 여기서는 조작마다 바로 저장된다. 나가는 것은 되돌리기가 아니라 완료다 */}
          {editing ? <Check /> : <Pencil />}
        </button>
      </div>

      {/* 설계 전제 ① — Product 당 기록 수는 오래도록 1에 머문다.
          그래서 표본 수를 늘 함께 보여주고 비율을 단독으로 결론처럼 쓰지 않는다 (설계 7-3) */}
      <p className="mt-0.5 text-[13px] text-muted">
        {sampleSize === 0
          ? "아직 아무도 기록하지 않았다."
          : `기록 ${sampleSize}명 기준. 표본이 적으면 비율은 그 사람의 판정일 뿐이다.`}
      </p>

      {error && (
        <p className="mt-3 rounded-[10px] border border-hairline bg-surface-card p-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      {/* 읽을 때는 줄바꿈으로 흘린다. 노트 하나가 한 행을 다 쓰면 6개짜리 원두에서
          아래 내용이 화면 밖으로 밀린다.
          **수정할 때는 행으로 되돌린다** — 인라인 입력과 지우기 버튼이 폭을 요구한다 */}
      <ul className={editing ? "mt-4 space-y-2" : "mt-4 flex flex-wrap gap-2"}>
        {notes.map((n) => (
          <li
            key={n.id}
            className={`rounded-[10px] bg-surface-raised px-4 py-3 ${editing ? "" : "min-w-[104px]"}`}
          >
            <div className={editing ? "flex items-baseline justify-between gap-3" : ""}>
              <span className="min-w-0 text-[16px] font-medium text-ink">
                {n.raw}
                {n.nodeLabel ? (
                  <span className="ml-2 text-[12px] font-normal text-muted">{n.nodeLabel}</span>
                ) : (
                  <span className="ml-2 text-[12px] font-normal text-pending">미분류</span>
                )}
              </span>
              {editing && sampleSize > 0 && (
                <span className="tabular shrink-0 text-[13px] text-muted">
                  <span className="text-accent">{n.hitCount}</span> / {sampleSize}
                </span>
              )}
            </div>

            {/* 표본이 1이면 `1 / 1` 을 따로 적지 않는다. 분모가 1이면 비율이 정보가 아니고,
                `1 / 1` 로는 `모르겠음` 과 `못 느낌` 도 구분되지 않는다 — 그 한 사람의
                판정을 그대로 적는 것이 같은 자리에 더 많은 것을 담는다 */}
            {!editing && sampleSize === 1 && (
              <div className="text-[12px] text-muted">{soleVerdict(n.counts)}</div>
            )}
            {!editing && sampleSize > 1 && (
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[12px] text-muted">
                <span className="tabular">
                  <span className="text-accent">{n.hitCount}</span> / {sampleSize}
                </span>
                <span>강함 {n.counts.STRONG}</span>
                <span>약함 {n.counts.WEAK}</span>
                <span>모르겠음 {n.counts.UNSURE}</span>
                <span>못 느낌 {n.counts.MISS}</span>
              </div>
            )}

            {/* 고칠 수 있는 것은 **표기뿐**이다. nodeId 가 그대로라 동일성 키도 판정도
                안 움직인다. 추가 · 삭제는 어드민 몫이다 (요구 FR-9) — 그쪽은 키를
                움직이고 남의 기록에 항목을 밀어넣는 조작이다 */}
            {editing && (
              <div className="mt-3">
                <input
                  defaultValue={n.raw}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== n.raw) {
                      run(() => updateSellerNote(n.id, e.target.value, n.nodeId));
                    }
                  }}
                  className="h-11 w-full rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none"
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* 판매자가 안 적었는데 사람들이 느낀 향 (ExtraNote).
          판매자 노트 아래에 둔다 — 이 원두에 대한 주장이 먼저고 그에 없던 것이 다음이다.
          **여기서는 못 고친다.** 남의 기록이고, 내 것은 내 기록 화면에서 고친다 */}
      {peopleExtraNotes.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold text-ink">사람들이 느낀 향</h2>
            <span className="text-[12px] text-muted">판매자 노트에 없던 것</span>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {peopleExtraNotes.map((n) => (
              <li
                key={n.raw}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-card px-[14px] text-[14px]"
              >
                <span className="font-medium text-ink">{n.raw}</span>
                {n.nodeLabel ? (
                  <span className="text-[12px] text-muted">{n.nodeLabel}</span>
                ) : (
                  <span className="text-[12px] text-pending">미분류</span>
                )}
                {/* 표본 수를 늘 함께 보여준다 — 비율을 단독으로 결론처럼 쓰지 않는다 (설계 7-3) */}
                <span className="tabular text-[12px] text-muted">
                  <span className="text-accent">{n.count}</span> / {sampleSize}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <div className="mt-6 space-y-4">
          <p className="text-[12px] text-muted">
            표기가 틀린 노트는 고쳐서 쓴다. <span className="text-ink">노트 추가 · 삭제</span>
            는 어드민에서 한다 — 추가한 노트는 남이 이미 남긴 기록에도{" "}
            <span className="text-ink">못 느낌</span> 으로 들어간다.
          </p>

          <div>
            <div className="mb-2 text-[14px] font-medium text-muted">제품명</div>
            <div className="flex gap-2">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="h-11 flex-1 rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none"
              />
              <button
                type="button"
                disabled={pending || draftName.trim() === name}
                onClick={() => run(() => updateProductName(productId, draftName))}
                className="inline-flex min-h-11 items-center rounded-[10px] border border-hairline px-4 text-[14px] text-body disabled:text-muted-soft"
              >
                고치기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
