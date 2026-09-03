"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { issueInviteCode, revokeInviteCode, type InviteCodeRow } from "@/app/actions";

type Account = { id: string; displayName: string; role: "USER" | "ADMIN"; createdAt: Date };

// 초대 코드는 평문으로 저장한다 (설계 5-2). 그래서 발급한 뒤에도 목록에서 그대로 보인다 —
// 어드민이 직접 건네는 방식이 성립하려면 나중에 다시 볼 수 있어야 한다.
export function AccountAdmin({ accounts, codes }: { accounts: Account[]; codes: InviteCodeRow[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "실패했어요");
      else {
        setLabel("");
        router.refresh();
      }
    });

  // 설계 5-4 의 가입일 칸. 초대 코드의 「언제 소진됐나」는 아직 못 채운다 —
  // InviteCode 에 usedAt 컬럼이 없다. 코드를 소진시키는 교환 화면이 2차라
  // 그때 컬럼과 함께 붙인다 (docs/backlog.md)
  const joined = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;

  const state = (c: InviteCodeRow) =>
    c.usedBy ? `${c.usedBy.displayName} 이(가) 씀` : c.expired ? "만료" : "미사용";

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[15px] text-ink">초대 코드 발급</h2>
        <div className="flex gap-2">
          {/* bg-surface 는 globals.css 에 없다. 기존 어드민 입력이 전부 쓰는
              surface-sunken 으로 맞춘다 (admin-create.tsx · pending-queue.tsx) */}
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="누구에게 주는 코드인가"
            className="h-11 flex-1 rounded-[10px] bg-surface-sunken px-3.5 text-[15px] text-ink outline-none placeholder:text-muted-soft"
          />
          <button
            type="button"
            disabled={pending || !label.trim()}
            onClick={() => run(() => issueInviteCode(label))}
            className="min-h-10 rounded-[8px] bg-accent px-4 text-[14px] text-on-accent disabled:opacity-40"
          >
            발급
          </button>
        </div>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-[15px] text-ink">발급한 코드</h2>
        {codes.length === 0 ? (
          <p className="text-[13px] text-muted">발급한 코드가 없어요.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-muted">
              <tr>
                <th className="py-2 text-left font-normal">코드</th>
                <th className="py-2 text-left font-normal">누구에게</th>
                <th className="py-2 text-left font-normal">상태</th>
                <th className="py-2 text-right font-normal" />
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-t border-hairline">
                  <td className="tabular py-2 text-ink">{c.code}</td>
                  <td className="py-2 text-body">{c.label}</td>
                  <td className="py-2 text-muted">{state(c)}</td>
                  <td className="py-2 text-right">
                    {/* 소진된 코드에는 버튼을 안 그린다. 액션도 막지만 화면에서 먼저 보인다 —
                        답이 없는 선택지를 주지 않는다 */}
                    {!c.usedBy && (
                      <button
                        type="button"
                        disabled={pending}
                        aria-label={`${c.label} 코드 폐기`}
                        onClick={() => run(() => revokeInviteCode(c.id))}
                        className="text-[13px] text-muted underline disabled:opacity-40"
                      >
                        폐기
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[15px] text-ink">계정</h2>
        <table className="w-full text-[13px]">
          <thead className="text-muted">
            <tr>
              <th className="py-2 text-left font-normal">표시명</th>
              <th className="py-2 text-left font-normal">권한</th>
              <th className="py-2 text-left font-normal">가입일</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-t border-hairline">
                <td className="py-2 text-ink">{a.displayName}</td>
                <td className="py-2 text-muted">{a.role === "ADMIN" ? "어드민" : "사용자"}</td>
                <td className="tabular py-2 text-muted">{joined(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
