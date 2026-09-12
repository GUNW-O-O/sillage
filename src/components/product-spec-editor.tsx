"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateProductAttributes } from "@/app/actions";
import {
  parseAttributes,
  pruneAttributes,
  type CoffeeAttributes,
} from "@/lib/product-attributes";

import { Close, Pencil } from "./icons";
import { ProductDetailFields } from "./product-detail-fields";

// 원두 스펙(나라 · 가공 · 품종 …)은 등록할 때 잘못 넣기 쉽고, 그걸 알아차리는 곳은
// 기록을 볼 때다. 고치는 자리를 스펙 박스 안에 둔다 — 틀린 것을 보는 자리와
// 고치는 자리가 같아야 한다.
//
// attributes 는 동일성 키 @@unique([vendorId, category, normalizedName, noteSetHash])
// 밖이라 제품명 수정과 달리 충돌 검사가 없다. noteSetHash 도 안 움직이므로 기존 판정이
// 그대로 남는다 — scripts/check-edit.ts 가 이 주장을 지킨다.
export function ProductSpecEditor({
  productId,
  attributes,
  fields,
  gradient,
}: {
  productId: string;
  attributes: Record<string, unknown>;
  fields: { label: string; value: string }[];
  /// 이 원두의 프로필 띠. 노트에 색이 하나도 없으면 null 이라 안 그린다
  gradient: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [attrs, setAttrs] = useState<CoffeeAttributes>(() => parseAttributes(attributes));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () => {
    // 취소하고 다시 열면 저장된 값에서 시작한다. 버린 편집이 남아 있으면 안 된다
    setAttrs(parseAttributes(attributes));
    setError(null);
    setEditing(true);
  };

  const save = () =>
    startTransition(async () => {
      const res = await updateProductAttributes(productId, pruneAttributes(attrs));
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });

  return (
    <section className="mt-4 overflow-hidden rounded-[10px] bg-surface-card px-4 py-3">
      {/* 띠는 박스의 상단 경계 자체다 — 제목 위에 얹힌 막대가 아니라 카드의 일부로 읽힌다.
          음수 마진으로 px-4 py-3 을 상쇄해 모서리까지 채우고 overflow-hidden 이 잘라낸다 */}
      {gradient && (
        <div
          aria-hidden
          data-testid="note-gradient"
          className="-mx-4 -mt-3 mb-2.5 h-2.5"
          style={{ backgroundImage: gradient }}
        />
      )}

      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-medium text-muted">원두 정보</h2>
        <button
          type="button"
          onClick={editing ? () => setEditing(false) : open}
          aria-label={editing ? "수정 취소" : "원두 정보 수정"}
          className="-mr-2 flex h-11 w-11 items-center justify-center text-muted"
        >
          {/* 취소는 편집을 버리고 저장값으로 돌아간다 — 그래서 Check 가 아니라 Close */}
          {editing ? <Close /> : <Pencil />}
        </button>
      </div>

      {editing ? (
        <>
          {/* 등록 폼과 같은 컴포넌트다. 다른 것은 순차 노출을 끄는 것뿐 —
              수정하러 온 사람은 어디가 틀렸는지 이미 알고 있다 */}
          <ProductDetailFields attrs={attrs} onChange={setAttrs} revealAll />

          {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}

          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="mt-6 h-12 w-full rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed disabled:bg-cta-disabled"
          >
            {pending ? "저장 중" : "저장"}
          </button>
        </>
      ) : fields.length > 0 ? (
        <dl className="mt-1">
          {fields.map((f) => (
            <div key={f.label} className="flex gap-3 py-1">
              <dt className="w-[64px] shrink-0 text-[13px] text-muted">{f.label}</dt>
              <dd className="text-[14px] text-body">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        // 등록할 때 상세를 안 채우면 여기가 빈다. 빈 박스를 감추면 고칠 입구도 같이 사라진다
        <p className="mt-1 text-[13px] text-muted">
          채운 정보가 없어요. 나라 · 가공을 채우면 나중에 그룹별 비교에 나와요.
        </p>
      )}
    </section>
  );
}
