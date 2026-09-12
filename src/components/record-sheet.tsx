"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { noteGradient } from "@/lib/note-gradient";
import { mixOnCanvas, readableOn } from "@/lib/readable-on";

import { ExtraNotes } from "./extra-notes";
import { Close, Pencil, Trash } from "./icons";

import {
  deleteRecord,
  getRecordDetail,
  saveRecord,
  type NoteHitValueInput,
  type NoteInput,
  type RecordDetail,
} from "@/app/actions";

// 목록에서 기록을 여는 것은 "보러" 여는 것이다. 라우트로 나가면 목록 맥락을 잃는다.
// 폰 기준이라 가운데 뜨는 박스가 아니라 아래에서 올라오는 시트다 (DESIGN.md).
const CYCLE: NoteHitValueInput[] = ["MISS", "UNSURE", "WEAK", "STRONG"];

const STYLE: Record<NoteHitValueInput, { label: string; cls: string }> = {
  MISS: { label: "못 느낌", cls: "border border-hairline text-muted-soft" },
  UNSURE: { label: "모르겠음", cls: "bg-surface-sunken text-muted" },
  WEAK: { label: "약함", cls: "bg-accent-tint text-accent-pressed" },
  STRONG: { label: "강함", cls: "bg-accent text-on-accent" },
};

/// 느낀 노트는 그 향의 색으로 칠한다 — 강함이 원색, 약함이 절반이다.
/// **못 느낌 · 모르겠음은 무채색으로 둔다.** 안 느낀 것에 색을 주면 띠와 어긋나고,
/// 화면이 색으로만 가득 차 강도가 안 읽힌다.
/// 색이 없는 노트(미매핑)는 지금까지 쓰던 accent 로 남는다 — 회색으로 채우지 않는 것과
/// 같은 이유로, 없는 색을 지어내지 않는다
function paint(value: NoteHitValueInput, color: string | null): React.CSSProperties | undefined {
  if (!color || (value !== "WEAK" && value !== "STRONG")) return undefined;
  const bg = value === "STRONG" ? color : mixOnCanvas(color, 0.5);
  return { backgroundColor: bg, color: readableOn(bg), borderColor: bg };
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function RecordSheet({ productId, onClose }: { productId: string; onClose: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, NoteHitValueInput>>({});
  const [extra, setExtra] = useState<NoteInput[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getRecordDetail(productId).then((d) => {
      setDetail(d);
      if (d) {
        setValues(Object.fromEntries(d.notes.map((n) => [n.id, n.value])));
        setExtra(d.extraNotes);
      }
    });
  }, [productId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const summary = useMemo(() => {
    const counts = { STRONG: 0, WEAK: 0, UNSURE: 0, MISS: 0 };
    for (const n of detail?.notes ?? []) counts[values[n.id] ?? "MISS"] += 1;
    return counts;
  }, [detail, values]);

  const gradient = noteGradient(detail?.notes.map((n) => n.nodeColor) ?? []);

  const cycle = (id: string) =>
    setValues((v) => ({ ...v, [id]: CYCLE[(CYCLE.indexOf(v[id]) + 1) % CYCLE.length] }));

  const save = () =>
    startTransition(async () => {
      if (!detail) return;
      await saveRecord(
        detail.productId,
        detail.notes.map((n) => ({ sellerNoteId: n.id, value: values[n.id] })),
        extra,
      );
      setEditing(false);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      if (!confirm("이 기록을 지울까요? 판정이 함께 사라져요.")) return;
      await deleteRecord(productId);
      onClose();
      router.refresh();
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />

      <div className="relative flex max-h-[86dvh] w-full max-w-[560px] flex-col rounded-t-[18px] bg-canvas sm:rounded-[18px]">
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-2 py-1.5">
          <IconButton label="닫기" onClick={onClose}>
            <Close />
          </IconButton>
          <div className="flex">
            <IconButton
              label={editing ? "수정 취소" : "수정"}
              onClick={() => {
                if (editing && detail) {
                  setValues(Object.fromEntries(detail.notes.map((n) => [n.id, n.value])));
                  setExtra(detail.extraNotes);
                }
                setEditing((e) => !e);
              }}
            >
              {editing ? <Close /> : <Pencil />}
            </IconButton>
            <IconButton label="삭제" onClick={remove} danger>
              <Trash />
            </IconButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {!detail ? (
            <p className="py-10 text-center text-[14px] text-muted">불러오는 중이에요</p>
          ) : (
            <>
              <div className="pt-4">
                <div className="text-[13px] text-muted">{detail.vendorName}</div>
                <div className="mt-0.5 flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-[21px] font-semibold leading-tight text-ink">
                    {detail.productName}
                  </h2>
                  {/* 이 시트는 **내가 느낀 것**을 보는 자리다. 원두 쪽 정보와 남들의 판정,
                      그리고 스펙 · 노트를 고치는 자리는 원두 상세다 — 이름 옆이 그 입구다.
                      아래에 두면 내 판정을 다 지나쳐야 닿는다.
                      `button-secondary` 규격이다 (DESIGN). muted 텍스트로 두면 눌리는
                      것으로 안 읽힌다 — 스펙이 틀린 걸 발견해도 갈 곳을 못 찾는다 */}
                  <Link
                    href={`/products/${detail.productId}`}
                    className="flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-hairline bg-canvas px-[14px] text-[14px] font-medium text-ink"
                  >
                    원두 정보 · 수정
                  </Link>
                </div>
                <div className="mt-1 text-[12px] text-muted-soft">
                  {fmt(detail.createdAt)} 기록
                  {fmt(detail.updatedAt) !== fmt(detail.createdAt) &&
                    ` · ${fmt(detail.updatedAt)} 수정`}
                </div>
              </div>

              {detail.fields.length > 0 && (
                <dl className="mt-4 overflow-hidden rounded-[10px] bg-surface-card px-4 py-3">
                  {/* 이 원두의 프로필 띠. 박스의 상단 경계 자체가 된다 — 음수 마진으로
                      px-4 py-3 을 상쇄해 모서리까지 꽉 채우고, overflow-hidden 이
                      둥근 모서리로 잘라낸다. 원두 상세와 같은 띠다 */}
                  {gradient && (
                    <div
                      aria-hidden
                      data-testid="note-gradient"
                      className="-mx-4 -mt-3 mb-2.5 h-2.5"
                      style={{ backgroundImage: gradient }}
                    />
                  )}
                  {detail.fields.map((f) => (
                    <div key={f.label} className="flex gap-3 py-1">
                      <dt className="w-[64px] shrink-0 text-[13px] text-muted">{f.label}</dt>
                      <dd className="text-[14px] text-body">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="mt-6 flex items-baseline justify-between">
                <h3 className="text-[15px] font-semibold text-ink">
                  판매자 노트 {detail.notes.length}개
                </h3>
                <span className="tabular text-[12px] text-muted">
                  강함 {summary.STRONG} · 약함 {summary.WEAK} · 모르겠음 {summary.UNSURE} · 못 느낌{" "}
                  {summary.MISS}
                </span>
              </div>
              {editing && (
                <p className="mt-1 text-[13px] text-muted">
                  느낀 것만 눌러 주세요. 안 건드린 노트는 <span className="text-ink">못 느낌</span> 이 돼요.
                </p>
              )}

              <ul data-testid="note-judgements" className="mt-3 flex flex-wrap gap-2">
                {detail.notes.map((n) => {
                  const v = values[n.id] ?? "MISS";
                  const s = STYLE[v];
                  const tone = paint(v, n.nodeColor);
                  const base = `inline-flex min-h-14 min-w-[92px] flex-col items-start justify-center rounded-[14px] px-4 py-2 text-left ${tone ? "" : s.cls}`;
                  const content = (
                    <>
                      <span className="flex items-center gap-1.5 text-[16px] font-medium">
                        {n.raw}
                        {/* 아직 축이 안 붙은 노트. 판정은 되지만 집계에는 안 들어간다 */}
                        {!n.nodeId && (
                          <span className="rounded-full border border-current px-1 text-[10px] opacity-60">
                            미분류
                          </span>
                        )}
                        {/* 기록 당시 화면에 없던 노트. 한 번은 보게 만든다 (설계 7-4) */}
                        {n.addedAfterRecord && (
                          <span className="rounded-full border border-current px-1 text-[10px]">
                            새로 추가됨
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 text-[12px] opacity-80">{s.label}</span>
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {editing ? (
                        <button type="button" onClick={() => cycle(n.id)} className={base} style={tone}>
                          {content}
                        </button>
                      ) : (
                        <div className={base} style={tone}>
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <ExtraNotes notes={extra} onChange={setExtra} editable={editing} />
            </>
          )}
        </div>

        {editing && (
          <div className="shrink-0 border-t border-hairline bg-surface-raised px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="h-12 w-full rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed disabled:bg-cta-disabled"
            >
              {pending ? "저장 중" : "저장"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
