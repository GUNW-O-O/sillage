"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  approveLookupEdited,
  approveVendorWith,
  mergeLookup,
  mergeVendor,
  rejectLookup,
  rejectVendor,
  type PendingLookup,
  type PendingVendor,
} from "@/app/actions";

import { Modal } from "./modal";

const KIND_LABEL: Record<string, string> = {
  COUNTRY: "나라",
  VARIETY: "품종",
  PROCESS: "가공",
};

type Option = { id: string; nameKo: string };
type Row = {
  kind: "vendor" | "lookup";
  id: string;
  name: string;
  nameEn?: string | null;
  lookupKind?: string;
};
type Action = { mode: "approve" | "merge"; row: Row };

// 인라인 추가된 값은 pending 으로 들어온다 (설계 4-8).
// 승인하거나 기존 값에 흡수시킨다 — 병합의 실체는 삭제가 아니라 흡수다.
export function PendingQueue({
  vendors,
  lookups,
  options,
  vendorOptions,
}: {
  vendors: PendingVendor[];
  lookups: PendingLookup[];
  options: Record<string, Option[]>;
  vendorOptions: Option[];
}) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했다");
      else {
        setAction(null);
        router.refresh();
      }
    });

  if (vendors.length === 0 && lookups.length === 0) {
    return <p className="text-[15px] text-muted">승인 대기 항목이 없다.</p>;
  }

  const Buttons = ({ row }: { row: Row }) => (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => setAction({ mode: "approve", row })}
        className="inline-flex min-h-10 items-center rounded-[8px] bg-cta px-4 text-[14px] font-medium text-on-cta"
      >
        승인
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setAction({ mode: "merge", row })}
        className="inline-flex min-h-10 items-center rounded-[8px] border border-hairline px-4 text-[14px] text-body"
      >
        기존 값에 흡수
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`“${row.name}” 를 지운다. 이 값을 쓰던 원두에서도 빠진다.`)) return;
          run(() => (row.kind === "vendor" ? rejectVendor(row.id) : rejectLookup(row.id)));
        }}
        className="inline-flex min-h-10 items-center rounded-[8px] border border-hairline px-4 text-[14px] text-danger"
      >
        지우기
      </button>
    </div>
  );

  const mergeOptions =
    action?.row.kind === "vendor" ? vendorOptions : (options[action?.row.lookupKind ?? ""] ?? []);

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-[10px] border border-hairline bg-surface-card p-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      {vendors.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-[16px] font-semibold text-ink">로스터리</h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline text-[13px] text-muted">
                <th className="py-2 font-medium">이름</th>
                <th className="py-2 font-medium">원두</th>
                <th className="py-2 font-medium">처리</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-b border-hairline-soft">
                  <td className="py-3 text-[16px] text-ink">{v.name}</td>
                  <td className="tabular py-3 text-[14px] text-muted">{v.productCount}</td>
                  <td className="py-3">
                    <Buttons row={{ kind: "vendor", id: v.id, name: v.name }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {lookups.length > 0 && (
        <section>
          <h2 className="mb-2 text-[16px] font-semibold text-ink">품종 · 가공</h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline text-[13px] text-muted">
                <th className="py-2 font-medium">종류</th>
                <th className="py-2 font-medium">이름</th>
                <th className="py-2 font-medium">처리</th>
              </tr>
            </thead>
            <tbody>
              {lookups.map((l) => (
                <tr key={l.id} className="border-b border-hairline-soft">
                  <td className="py-3 text-[13px] text-muted">{KIND_LABEL[l.kind] ?? l.kind}</td>
                  <td className="py-3 text-[16px] text-ink">{l.nameKo}</td>
                  <td className="py-3">
                    <Buttons
                      row={{
                        kind: "lookup",
                        id: l.id,
                        name: l.nameKo,
                        nameEn: l.nameEn,
                        lookupKind: l.kind,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {action?.mode === "approve" && (
        <ApproveModal
          row={action.row}
          pending={pending}
          onClose={() => setAction(null)}
          onSubmit={(nameKo, nameEn, aliases) =>
            run(() =>
              action.row.kind === "vendor"
                ? approveVendorWith(action.row.id, aliases)
                : approveLookupEdited(action.row.id, nameKo, nameEn, aliases),
            )
          }
        />
      )}

      {action?.mode === "merge" && (
        <Modal title="어느 값에 흡수할까" subject={action.row.name} onClose={() => setAction(null)}>
          <p className="mb-4 text-[13px] text-muted">
            “{action.row.name}” 는 고른 값의 별칭이 되고, 이 값을 쓰는 것들은 그쪽으로 갈아탄다.
            원본은 사라진다.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {mergeOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    action.row.kind === "vendor"
                      ? mergeVendor(action.row.id, o.id)
                      : mergeLookup(action.row.id, o.id),
                  )
                }
                className="inline-flex min-h-10 items-center rounded-full border border-hairline bg-surface-raised px-3.5 text-[14px] text-body"
              >
                {o.nameKo}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// 승인 시점이 이름을 정돈할 유일한 자리다.
// 등록 중에 급히 친 표기("Ombligon")가 그대로 굳으면 나중에 고칠 경로가 없다.
// 바꾼 원래 표기는 자동으로 별칭에 남아 다음에 같은 표기로 들어와도 갈라지지 않는다.
function ApproveModal({
  row,
  pending,
  onClose,
  onSubmit,
}: {
  row: Row;
  pending: boolean;
  onClose: () => void;
  onSubmit: (nameKo: string, nameEn: string, aliases: string[]) => void;
}) {
  const isLookup = row.kind === "lookup";
  const [nameKo, setNameKo] = useState(row.name);
  const [nameEn, setNameEn] = useState(row.nameEn ?? "");
  const [aliases, setAliases] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || aliases.includes(v)) return;
    setAliases((a) => [...a, v]);
    setDraft("");
  };

  const renamed = isLookup && nameKo.trim() !== row.name;

  return (
    <Modal title="승인" subject={row.name} onClose={onClose}>
      {isLookup && (
        <>
          <label className="mb-3 block">
            <span className="mb-1.5 block text-[13px] text-muted">한글 이름</span>
            <input
              value={nameKo}
              onChange={(e) => setNameKo(e.target.value)}
              className="h-11 w-full rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none"
            />
          </label>
          <label className="mb-3 block">
            <span className="mb-1.5 block text-[13px] text-muted">영문 이름</span>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Ombligon"
              className="h-11 w-full rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none placeholder:text-muted-soft"
            />
          </label>
          {renamed && (
            <p className="mb-3 text-[12px] text-muted">
              원래 표기 “{row.name}” 는 별칭으로 남는다.
            </p>
          )}
        </>
      )}

      <p className="mb-3 text-[13px] text-muted">
        같은 것을 가리키는 다른 표기를 함께 적어둔다. 다음에 그 표기로 들어와도 갈라지지 않는다.
      </p>

      {aliases.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {aliases.map((a) => (
            <li key={a}>
              <button
                type="button"
                onClick={() => setAliases((x) => x.filter((v) => v !== a))}
                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-surface-card px-3 text-[13px] text-ink"
              >
                {a}
                <span className="text-muted-soft">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="별칭 (선택)"
          className="h-11 flex-1 rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none placeholder:text-muted-soft"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex min-h-11 items-center rounded-[10px] border border-hairline px-4 text-[14px] text-body"
        >
          추가
        </button>
      </div>

      <button
        type="button"
        disabled={pending || !nameKo.trim()}
        onClick={() => onSubmit(nameKo, nameEn, aliases)}
        className="mt-5 h-11 w-full rounded-[10px] bg-cta text-[15px] font-semibold text-on-cta active:bg-cta-pressed disabled:bg-cta-disabled"
      >
        승인
      </button>
    </Modal>
  );
}
