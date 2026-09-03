"use client";

import { useState, useTransition } from "react";

import {
  addSellerNote,
  deleteSellerNote,
  getAdminProduct,
  searchProductsGlobal,
  type AdminProduct,
  type NoteInput,
  type ProductGlobalHit,
} from "@/app/actions";
import { MIN_QUERY_LENGTH } from "@/lib/search-tuning";

import { NoteChips } from "./note-input";

// Product 노트 추가 · 삭제 (요구 FR-9 — 잘못 지운 것 복구 · 빠뜨린 노트 보강).
//
// 사용자 화면에서 옮겨온 것이다. 둘 다 noteSetHash 를 움직여 다른 원두와 키가 충돌할 수
// 있고, 충돌하면 막히는데 그때 일반 사용자가 할 수 있는 것이 없다 (병합이 없다).
// 추가는 그 위에 **남이 이미 남긴 기록에 항목을 밀어넣는** 조작이다.
//
// 미매핑 큐와 단위가 다르다. 저쪽은 표현(raw) 하나를 여러 원두에 걸쳐 처리하고,
// 여기는 원두 하나의 노트 목록을 손본다. 그래서 화면을 나눈다.
export function AdminProductNotes() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductGlobalHit[]>([]);
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [adding, setAdding] = useState<NoteInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const search = () =>
    startTransition(async () => {
      setError(null);
      setHits(await searchProductsGlobal(query));
    });

  const open = (id: string) =>
    startTransition(async () => {
      setError(null);
      setAdding([]);
      setProduct(await getAdminProduct(id));
    });

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) {
        setError(r.message ?? "실패했어요");
        return;
      }
      if (product) setProduct(await getAdminProduct(product.id));
    });

  const commitAdds = () =>
    startTransition(async () => {
      if (!product) return;
      setError(null);
      // 하나씩 넣는다. 중간에 막히면 거기서 멈추고 이유를 보여준다 —
      // 한 번에 넣으면 어느 노트가 키 충돌을 만들었는지 알 수 없다
      for (const n of adding) {
        const r = await addSellerNote(product.id, n.raw, n.nodeId);
        if (!r.ok) {
          setError(r.message);
          setProduct(await getAdminProduct(product.id));
          return;
        }
      }
      setAdding([]);
      setProduct(await getAdminProduct(product.id));
    });

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-[10px] border border-hairline bg-surface-card p-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="원두명 검색"
          className="h-11 flex-1 rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none"
        />
        <button
          type="button"
          disabled={pending || query.trim().length < MIN_QUERY_LENGTH}
          onClick={search}
          className="inline-flex min-h-11 items-center rounded-[10px] bg-cta px-5 text-[14px] font-medium text-on-cta disabled:bg-cta-disabled"
        >
          찾기
        </button>
      </div>
      {query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH && (
        <p className="mt-2 text-[13px] text-muted">{MIN_QUERY_LENGTH}글자 이상 입력해 주세요.</p>
      )}

      {hits.length > 0 && (
        <ul className="mt-3 border-t border-hairline">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => open(h.id)}
                className="flex min-h-11 w-full items-center justify-between border-b border-hairline-soft py-2 text-left"
              >
                <span className="text-[15px] text-ink">{h.name}</span>
                {/* 원두 이름은 전역 유일하지 않다. 로스터리명이 없으면 못 고른다 */}
                <span className="text-[13px] text-muted">
                  {h.vendorName} · 노트 {h.noteCount}개
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {product && (
        <section className="mt-8 border-t border-hairline pt-6">
          <div className="text-[13px] text-muted">{product.vendorName}</div>
          <h2 className="mt-0.5 text-[20px] font-semibold text-ink">{product.name}</h2>
          <p className="mt-1 text-[13px] text-muted">
            기록 {product.sampleSize}명. 노트를 추가하면 그 기록들에{" "}
            <span className="text-ink">못 느낌</span> 으로 들어가고, 기록한 사람이 다음에 열 때
            보여요.
          </p>

          <table className="mt-4 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline text-[13px] text-muted">
                <th className="py-2 font-medium">노트</th>
                <th className="py-2 font-medium">축</th>
                <th className="py-2 font-medium">판정</th>
                <th className="py-2 font-medium">처리</th>
              </tr>
            </thead>
            <tbody>
              {product.notes.map((n) => (
                <tr key={n.id} className="border-b border-hairline-soft">
                  <td className="py-2.5 text-[15px] text-ink">{n.raw}</td>
                  <td className="py-2.5 text-[13px]">
                    {n.nodeLabel ? (
                      <span className="text-muted">{n.nodeLabel}</span>
                    ) : (
                      <span className="text-pending">미분류</span>
                    )}
                  </td>
                  <td className="tabular py-2.5 text-[13px] text-muted">{n.hitCount}건</td>
                  <td className="py-2.5">
                    {/* 판정이 붙었거나 마지막 하나면 서버가 막는다. 누를 수 없게 해서
                        왜 안 되는지를 먼저 보여준다 */}
                    <button
                      type="button"
                      disabled={pending || n.hitCount > 0 || product.notes.length <= 1}
                      title={
                        n.hitCount > 0
                          ? "판정이 붙어 있어요. 표기가 틀린 것이면 원두 화면에서 고쳐 쓰세요"
                          : product.notes.length <= 1
                            ? "마지막 노트는 지울 수 없어요"
                            : undefined
                      }
                      onClick={() => {
                        if (!confirm(`“${n.raw}” 를 지울까요?`)) return;
                        run(() => deleteSellerNote(n.id));
                      }}
                      className="inline-flex min-h-9 items-center rounded-[8px] border border-hairline px-3 text-[13px] text-danger disabled:border-hairline-soft disabled:text-muted-soft"
                    >
                      지우기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6">
            <div className="mb-2 text-[14px] font-medium text-muted">노트 추가</div>
            <NoteChips notes={adding} onChange={setAdding} />
            {adding.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={commitAdds}
                className="mt-3 inline-flex min-h-11 items-center rounded-[10px] bg-cta px-5 text-[15px] font-semibold text-on-cta"
              >
                {adding.length}개 추가
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
