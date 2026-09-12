"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createFlavorNodeL2,
  createLookupApproved,
  createVendorApproved,
  updateFlavorNode,
} from "@/app/actions";

import { Modal } from "./modal";

function useSubmit() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했어요");
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
            바꿔요</strong>. 바꾸려면 데이터 마이그레이션이 필요해요.
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

/// 노드의 라벨과 부모를 고친다 (설계 2026-09-08 §7).
/// 만들기만 되고 고칠 수단이 없으면 계층을 손볼 방법이 seed 재작성뿐이다 —
/// seed 는 어드민이 고친 값을 덮지 않으므로 이미 도는 DB 에는 안 닿는다.
export function EditFlavorNode({
  id,
  labelKo: ko0,
  labelEn: en0,
  color: color0,
  inheritedColor,
  parentId,
  parents,
}: {
  id: string;
  labelKo: string;
  labelEn: string;
  /// 이 노드에 직접 박힌 색. null 이면 부모에서 물려받는 중이다
  color: string | null;
  /// 비웠을 때 대신 칠해질 색. 「지우면 무엇이 되는가」를 보여줘야 비울 수 있다
  inheritedColor: string | null;
  /// null 이면 Level 1. 부모 선택을 안 보여준다 — L1 아홉 개는 골격이라 안 옮긴다 (설계 7-4)
  parentId: string | null;
  parents: { id: string; labelKo: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [labelKo, setKo] = useState(ko0);
  const [labelEn, setEn] = useState(en0);
  const [color, setColor] = useState(color0 ?? "");
  const [parent, setParent] = useState(parentId);
  const { error, pending, run } = useSubmit();

  // 닫을 때가 아니라 열 때 되돌린다 — 저장 뒤 router.refresh() 로 새 값이 오는데
  // 닫으면서 옛 prop 으로 되돌리면 다음에 열었을 때 지워진 값이 보인다
  const start = () => {
    setKo(ko0);
    setEn(en0);
    setColor(color0 ?? "");
    setParent(parentId);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="shrink-0 text-[12px] text-muted underline-offset-2 hover:underline"
      >
        고치기
      </button>
      {open && (
        <Modal title="노드 고치기" subject={ko0} onClose={() => setOpen(false)}>
          <p className="mb-3 text-[13px] text-muted">
            id <code className="text-ink">{id}</code> 는 집계 축이라{" "}
            <strong className="text-ink">안 바뀌어요</strong>. 부모를 옮겨도 이 노드에 붙은
            판매자 노트는 그대로라 판정값이 안 움직여요.
          </p>
          <Text label="한글 라벨" value={labelKo} onChange={setKo} />
          <Text label="영문 라벨" value={labelEn} onChange={setEn} />

          {/* 색은 상속이 기본이다 — 비우면 부모 색으로 돌아간다 (설계 2026-09-08 §6).
              색판과 글자 칸을 함께 둔다. 색판만 두면 지금 값이 무엇인지 못 읽고,
              글자 칸만 두면 hex 를 손으로 맞춰야 한다 */}
          <div className="mb-3">
            <span className="mb-1.5 block text-[13px] text-muted">색</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="색 고르기"
                value={color || inheritedColor || "#888888"}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-[10px] bg-surface-sunken p-1"
              />
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={inheritedColor ? `${inheritedColor} 물려받는 중` : "색 없음"}
                className="h-11 min-w-0 flex-1 rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none placeholder:text-muted-soft"
              />
              {color && (
                <button
                  type="button"
                  onClick={() => setColor("")}
                  className="h-11 shrink-0 rounded-[10px] border border-hairline px-3 text-[13px] text-muted"
                >
                  비우기
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[12px] text-muted-soft">
              비우면 {inheritedColor ? "부모 색을 물려받아요" : "색이 없어져서 띠에서 빠져요"}.
            </p>
          </div>
          {parentId && (
            <div className="mb-3">
              <span className="mb-1.5 block text-[13px] text-muted">부모</span>
              <div className="flex flex-wrap gap-1.5">
                {parents.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setParent(p.id)}
                    className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-[14px] ${
                      parent === p.id
                        ? "border-cta bg-surface-card font-medium text-ink"
                        : "border-hairline bg-surface-raised text-body"
                    }`}
                  >
                    {p.labelKo}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Submit
            label="고치기"
            pending={pending}
            error={error}
            onClick={() =>
              run(
                () => updateFlavorNode(id, parent, labelKo, labelEn, color),
                () => setOpen(false),
              )
            }
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
            Product 동일성 키를 우회하는 유일한 경로가 표기 흔들림이에요. 별칭을 함께 적어 두면
            대부분 사라져요.
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
