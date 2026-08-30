"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createFlavorNodeL2, createLookupApproved, createVendorApproved } from "@/app/actions";

import { Modal } from "./modal";

function useSubmit() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했다");
      else {
        done();
        router.refresh();
      }
    });

  return { error, pending, run, setError };
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[13px] text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none placeholder:text-muted-soft"
      />
    </label>
  );
}

// 표기 흔들림을 흡수하는 경로가 aliases 뿐이라 추가 시점에 같이 받는다
function AliasInput({ aliases, onChange }: { aliases: string[]; onChange: (a: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || aliases.includes(v)) return;
    onChange([...aliases, v]);
    setDraft("");
  };
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-[13px] text-muted">별칭</span>
      {aliases.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {aliases.map((a) => (
            <li key={a}>
              <button
                type="button"
                onClick={() => onChange(aliases.filter((x) => x !== a))}
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
          placeholder="같은 것을 가리키는 다른 표기"
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
    </div>
  );
}

function Submit({
  label,
  pending,
  onClick,
  error,
}: {
  label: string;
  pending: boolean;
  onClick: () => void;
  error: string | null;
}) {
  return (
    <>
      {error && <p className="mb-3 text-[14px] text-danger">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="h-11 w-full rounded-[10px] bg-cta text-[15px] font-semibold text-on-cta active:bg-cta-pressed"
      >
        {label}
      </button>
    </>
  );
}

export function AddFlavorNode({ parentId, parentLabel }: { parentId: string; parentLabel: string }) {
  const [open, setOpen] = useState(false);
  const [labelKo, setKo] = useState("");
  const [labelEn, setEn] = useState("");
  const { error, pending, run } = useSubmit();

  const close = () => {
    setOpen(false);
    setKo("");
    setEn("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-[8px] border border-dashed border-hairline py-2 text-[13px] text-muted"
      >
        + Level 2 추가
      </button>
      {open && (
        <Modal title={`${parentLabel} 아래에 추가`} subject="Level 2 노드" onClose={close}>
          <p className="mb-3 text-[13px] text-muted">
            id 는 영문 라벨에서 만들어지고 <strong className="text-ink">집계 축이라 나중에 못
            바꾼다</strong>. 바꾸려면 데이터 마이그레이션이 필요하다.
          </p>
          <Text label="한글 라벨" value={labelKo} onChange={setKo} placeholder="예: 열대과일" />
          <Text label="영문 라벨 (id 의 근거)" value={labelEn} onChange={setEn} placeholder="Tropical Fruit" />
          {labelEn.trim() && (
            <p className="mb-3 text-[12px] text-muted">
              id → <code className="text-ink">{labelEn.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}</code>
            </p>
          )}
          <Submit
            label="추가"
            pending={pending}
            error={error}
            onClick={() => run(() => createFlavorNodeL2(parentId, labelKo, labelEn), close)}
          />
        </Modal>
      )}
    </>
  );
}

export function AddLookup({ kind, label }: { kind: "VARIETY" | "PROCESS"; label: string }) {
  const [open, setOpen] = useState(false);
  const [nameKo, setKo] = useState("");
  const [nameEn, setEn] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const { error, pending, run } = useSubmit();

  const close = () => {
    setOpen(false);
    setKo("");
    setEn("");
    setAliases([]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center rounded-[8px] bg-cta px-4 text-[14px] font-medium text-on-cta"
      >
        + {label} 추가
      </button>
      {open && (
        <Modal title={`${label} 추가`} subject={nameKo || "새 항목"} onClose={close}>
          <Text label="한글 이름" value={nameKo} onChange={setKo} />
          <Text label="영문 이름" value={nameEn} onChange={setEn} />
          <AliasInput aliases={aliases} onChange={setAliases} />
          <Submit
            label="추가"
            pending={pending}
            error={error}
            onClick={() => run(() => createLookupApproved(kind, nameKo, nameEn, aliases), close)}
          />
        </Modal>
      )}
    </>
  );
}

export function AddVendor() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const { error, pending, run } = useSubmit();

  const close = () => {
    setOpen(false);
    setName("");
    setAliases([]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center rounded-[8px] bg-cta px-4 text-[14px] font-medium text-on-cta"
      >
        + 로스터리 추가
      </button>
      {open && (
        <Modal title="로스터리 추가" subject={name || "새 로스터리"} onClose={close}>
          <p className="mb-3 text-[13px] text-muted">
            Product 동일성 키를 우회하는 유일한 경로가 표기 흔들림이다. 별칭을 함께 적어두면
            대부분 사라진다.
          </p>
          <Text label="이름" value={name} onChange={setName} placeholder="커피리브레" />
          <AliasInput aliases={aliases} onChange={setAliases} />
          <Submit
            label="추가"
            pending={pending}
            error={error}
            onClick={() => run(() => createVendorApproved(name, aliases), close)}
          />
        </Modal>
      )}
    </>
  );
}
