"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { mergeAlias, remapAlias, setAliasColor, unmapAlias, type FlavorTreeNode } from "@/app/actions";
import { readableOn } from "@/lib/readable-on";

import { AddFlavorNode, EditFlavorNode } from "./admin-create";
import { Modal } from "./modal";

type L1 = FlavorTreeNode & { children: FlavorTreeNode[] };

// 색이 어디서 왔는지가 보여야 한다. 띠가 온통 한 색으로 나오는 원인이 대개
// 「L2 가 제 색 없이 L1 을 상속한다」인데, 색만 찍으면 그것이 안 보인다.
//   꽉 찬 점 = 이 노드가 제 색을 가졌다
//   빈 점   = 부모에서 물려받는 중
//   빗금 점 = 계층 어디에도 색이 없다 (띠에서 이 노트는 빠진다)
function ColorDot({
  nodeId,
  color,
  inherited,
}: {
  nodeId: string;
  color: string | null;
  inherited: boolean;
}) {
  if (!color) {
    return (
      <span
        data-testid={`dot-${nodeId}`}
        title="색이 없어요 — 띠에서 빠져요"
        className="inline-block size-3 shrink-0 rounded-full border border-dashed border-muted-soft"
      />
    );
  }
  return (
    <span
      data-testid={`dot-${nodeId}`}
      title={inherited ? `${color} (부모에서 물려받음)` : color}
      style={inherited ? { borderColor: color } : { backgroundColor: color }}
      className={`inline-block size-3 shrink-0 rounded-full ${inherited ? "border-2" : ""}`}
    />
  );
}

// 어느 표현이 어느 축에 앉았는지 보이는 것이 잘못 붙인 것을 찾는 유일한 방법이다.
// 그래서 계층만 보여주지 않고 붙은 별칭을 노드 안에 함께 편다 (설계 7-4).
export function FlavorTree({ tree }: { tree: L1[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<{
    id: string;
    raw: string;
    nodeLabel: string;
    /// 이 표현만의 덮어쓰기. null 이면 축에서 물려받는 중이다
    color: string | null;
    /// 비웠을 때 대신 칠해질 색 — 「지우면 무엇이 되는가」를 보여줘야 비울 수 있다
    inherited: string | null;
    /// 합칠 수 있는 같은 축의 표현. 한 행이 표기를 둘까지만 담아서 이미 합쳐진 것은 뺀다
    siblings: { id: string; raw: string }[];
    merged: boolean;
  } | null>(null);
  const [aliasColor, setAliasColor_] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const parents = tree.map((l1) => ({ id: l1.id, labelKo: l1.labelKo }));

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했어요");
      else {
        setTarget(null);
        router.refresh();
      }
    });

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-[10px] border border-hairline bg-surface-card p-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      <div className="space-y-6">
        {tree.map((l1) => (
          <section key={l1.id}>
            <div className="flex items-baseline gap-2 border-b border-hairline pb-1.5">
              <ColorDot nodeId={l1.id} color={l1.effectiveColor} inherited={l1.color === null} />
              <h2 className="text-[17px] font-semibold text-ink">{l1.labelKo}</h2>
              <span className="text-[12px] text-muted-soft">{l1.id}</span>
              <EditFlavorNode
                id={l1.id}
                labelKo={l1.labelKo}
                labelEn={l1.labelEn}
                color={l1.color}
                inheritedColor={null}
                parentId={null}
                parents={parents}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {l1.children.map((l2) => (
                <div
                  key={l2.id}
                  data-testid={`node-${l2.id}`}
                  // 테두리로 색을 보인다. 배경까지 칠하면 L1 아홉 × L2 스물여덟이
                  // 전부 색면이 되어 무엇이 무엇인지 안 읽힌다
                  style={l2.effectiveColor ? { borderColor: l2.effectiveColor } : undefined}
                  className={`rounded-[10px] bg-surface-raised p-3 ${
                    l2.effectiveColor ? "border-2" : "border border-hairline"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
                      <ColorDot nodeId={l2.id} color={l2.effectiveColor} inherited={l2.color === null} />
                      {l2.labelKo}
                    </span>
                    <EditFlavorNode
                      id={l2.id}
                      labelKo={l2.labelKo}
                      labelEn={l2.labelEn}
                      color={l2.color}
                      inheritedColor={l1.effectiveColor}
                      parentId={l1.id}
                      parents={parents}
                    />
                  </div>
                  <div className="text-[11px] text-muted-soft">{l2.id}</div>

                  {l2.aliases.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {l2.aliases.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              {
                                setTarget({
                                  id: a.id,
                                  raw: a.raw,
                                  nodeLabel: l2.labelKo,
                                  color: a.color,
                                  inherited: l2.effectiveColor,
                                  siblings: l2.aliases
                                    .filter((b) => b.id !== a.id && !b.rawEn)
                                    .map((b) => ({ id: b.id, raw: b.raw })),
                                  merged: !!a.rawEn,
                                });
                                setAliasColor_(a.color ?? "");
                              }
                            }
                            // 칩은 작아서 배경이 태그로 읽힌다. 글자색은 보색이 아니라
                            // 대비로 고른다 — 보색은 명도가 같아 더 안 읽힌다
                            // 별칭이 제 색을 가졌으면 그것이 축 색을 이긴다 —
                            // 화면이 실제 띠와 같은 색을 보여야 대조가 된다
                            style={
                              (a.color ?? l2.effectiveColor)
                                ? {
                                    backgroundColor: (a.color ?? l2.effectiveColor)!,
                                    color: readableOn((a.color ?? l2.effectiveColor)!),
                                  }
                                : undefined
                            }
                            className={`inline-flex min-h-8 items-center rounded-full px-2.5 text-[13px] ${
                              a.color ?? l2.effectiveColor ? "" : "bg-surface-card text-body"
                            }`}
                          >
                            {a.rawEn ? `${a.raw} · ${a.rawEn}` : a.raw}
                            {a.scope === "PERSONAL" && (
                              <span className="ml-1 text-[10px] opacity-70">개인</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[12px] text-muted-soft">붙은 표현이 없어요</p>
                  )}
                </div>
              ))}
            </div>

            <AddFlavorNode parentId={l1.id} parentLabel={l1.labelKo} />
          </section>
        ))}
      </div>

      {target && (
        <Modal
          title={`「${target.nodeLabel}」 에 붙어 있어요`}
          subject={target.raw}
          onClose={() => setTarget(null)}
        >
          <p className="mb-4 text-[13px] text-muted">
            옮기면 이 표현을 쓰는 판매자 노트가 함께 옮겨지고 noteSetHash 가 재계산돼요.
            <strong className="text-ink"> 판정값은 그대로예요</strong> — 축이 바뀐 것이지 판정이
            바뀐 게 아니에요.
          </p>

          {/* 색만 바꾸는 것은 축을 옮기는 것과 다르다 — noteSetHash 가 안 움직인다.
              그래서 옮기기 목록과 나란히 두지 않고 위에 따로 둔다 */}
          <div className="mb-5 rounded-[10px] border border-hairline p-3">
            <span className="mb-1.5 block text-[13px] text-muted">이 표현만의 색</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="색 고르기"
                value={aliasColor || target.inherited || "#888888"}
                onChange={(e) => setAliasColor_(e.target.value)}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-[10px] bg-surface-sunken p-1"
              />
              <input
                value={aliasColor}
                onChange={(e) => setAliasColor_(e.target.value)}
                placeholder={
                  target.inherited ? `${target.inherited} 물려받는 중` : "색 없음"
                }
                className="h-11 min-w-0 flex-1 rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none placeholder:text-muted-soft"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setAliasColor(target.id, aliasColor))}
                className="h-11 shrink-0 rounded-[10px] bg-cta px-4 text-[14px] font-semibold text-on-cta"
              >
                색 바꾸기
              </button>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-soft">
              비우고 눌러요 → {target.inherited ? "축의 색을 물려받아요" : "색이 없어져요"}.
              판정값도 noteSetHash 도 안 움직여요.
            </p>
          </div>

          {/* 같은 향의 한영 표기를 한 행으로. 축이 같은 것끼리만 되므로 같은 칸의 표현만 보인다 */}
          {!target.merged && target.siblings.length > 0 && (
            <div className="mb-5 rounded-[10px] border border-hairline p-3">
              <span className="mb-1.5 block text-[13px] text-muted">같은 향의 다른 표기와 합치기</span>
              <div className="flex flex-wrap gap-1.5">
                {target.siblings.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`“${target.raw}” 를 “${b.raw}” 의 다른 표기로 합칠까요?`)) return;
                      run(() => mergeAlias(target.id, b.id));
                    }}
                    className="inline-flex min-h-10 items-center rounded-full border border-hairline bg-surface-raised px-3.5 text-[14px] text-body"
                  >
                    {b.raw}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-muted-soft">
                이 표현은 고른 표현의 영문 표기로 들어가고 칩이 하나로 줄어요. 판정값은 그대로예요.
              </p>
            </div>
          )}

          {tree.map((l1) => (
            <div key={l1.id} className="mb-4 last:mb-0">
              <div className="mb-1.5 text-[12px] text-muted">{l1.labelKo}</div>
              <div className="flex flex-wrap gap-1.5">
                {l1.children.map((l2) => (
                  <button
                    key={l2.id}
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => remapAlias(target.id, l2.id))}
                    className="inline-flex min-h-10 items-center rounded-full border border-hairline bg-surface-raised px-3.5 text-[14px] text-body"
                  >
                    {l2.labelKo}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`“${target.raw}” 의 매핑을 지울까요? 미매핑 큐로 돌아가요.`)) return;
              run(() => unmapAlias(target.id));
            }}
            className="mt-5 h-11 w-full rounded-[10px] border border-hairline text-[15px] text-danger"
          >
            매핑 지우고 미매핑 큐로
          </button>
        </Modal>
      )}
    </div>
  );
}
