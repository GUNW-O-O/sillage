"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  deleteRecord,
  getRecordDetail,
  saveRecord,
  type NoteHitValueInput,
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

const Pencil = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" strokeLinejoin="round" />
    <path d="M14.5 6.5 17.5 9.5" />
  </svg>
);

const Trash = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Close = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
  </svg>
);

export function RecordSheet({ productId, onClose }: { productId: string; onClose: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, NoteHitValueInput>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getRecordDetail(productId).then((d) => {
      setDetail(d);
      if (d) setValues(Object.fromEntries(d.notes.map((n) => [n.id, n.value])));
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

  const cycle = (id: string) =>
    setValues((v) => ({ ...v, [id]: CYCLE[(CYCLE.indexOf(v[id]) + 1) % CYCLE.length] }));

  const save = () =>
    startTransition(async () => {
      if (!detail) return;
      await saveRecord(
        detail.productId,
        detail.notes.map((n) => ({ sellerNoteId: n.id, value: values[n.id] })),
      );
      setEditing(false);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      if (!confirm("이 기록을 지운다. 판정이 함께 사라진다.")) return;
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
            <p className="py-10 text-center text-[14px] text-muted">불러오는 중</p>
          ) : (
            <>
              <div className="pt-4">
                <div className="text-[13px] text-muted">{detail.vendorName}</div>
                <h2 className="mt-0.5 text-[21px] font-semibold leading-tight text-ink">
                  {detail.productName}
                </h2>
                <div className="mt-1 text-[12px] text-muted-soft">
                  {fmt(detail.createdAt)} 기록
                  {fmt(detail.updatedAt) !== fmt(detail.createdAt) &&
                    ` · ${fmt(detail.updatedAt)} 수정`}
                </div>
              </div>

              {detail.fields.length > 0 && (
                <dl className="mt-4 rounded-[10px] bg-surface-card px-4 py-3">
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
                  느낀 것만 탭한다. 안 건드린 노트는 <span className="text-ink">못 느낌</span> 이다.
                </p>
              )}

              <ul className="mt-3 flex flex-wrap gap-2">
                {detail.notes.map((n) => {
                  const s = STYLE[values[n.id] ?? "MISS"];
                  const base = `inline-flex min-h-14 min-w-[92px] flex-col items-start justify-center rounded-[14px] px-4 py-2 text-left ${s.cls}`;
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
                      </span>
                      <span className="mt-0.5 text-[12px] opacity-80">{s.label}</span>
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {editing ? (
                        <button type="button" onClick={() => cycle(n.id)} className={base}>
                          {content}
                        </button>
                      ) : (
                        <div className={base}>{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
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
