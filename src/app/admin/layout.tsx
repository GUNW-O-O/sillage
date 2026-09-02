import { notFound } from "next/navigation";
import Link from "next/link";

import { adminStats } from "@/app/actions";
import { currentUser } from "@/lib/auth/identity";

// 어드민은 PC 전용 · 전부 CSR 이다 (설계 7-4). 반응형 대상에서 빼면 표와 폼으로 끝나고,
// SEO 대상이 아니라 SSR 도 Workers CPU 한도와도 무관하다.
//
// 접근 통제는 서버가 한다 — 공개 URL 이라 경로만 알면 요청이 들어온다.
// 레이아웃과 어드민 액션 양쪽에서 확인한다. 레이아웃만으로는 부족하다 —
// 서버 액션은 화면을 안 거치고도 불린다 (설계 4-1).
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "개요", key: "unmapped" as const },
  { href: "/admin/unmapped", label: "미매핑 노트", key: "unmapped" as const },
  { href: "/admin/proposals", label: "노트 제안", key: "proposals" as const },
  { href: "/admin/products", label: "원두 노트", key: null },
  { href: "/admin/pending", label: "승인 대기", key: "pending" as const },
  { href: "/admin/flavors", label: "향 계층", key: null },
  { href: "/admin/lookups", label: "품종 · 가공", key: null },
  { href: "/admin/vendors", label: "로스터리", key: null },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // **403 이 아니라 404 다.** 403 은 "여기 어드민이 있다" 를 알려준다 (설계 4-2)
  const user = await currentUser();
  if (user?.role !== "ADMIN") notFound();

  const stats = await adminStats();
  const badge = {
    unmapped: stats.unmapped,
    pending: stats.pendingVendors + stats.pendingLookups,
    proposals: stats.proposals,
  };

  return (
    <div className="flex min-h-dvh">
      <aside className="w-[220px] shrink-0 border-r border-hairline bg-surface-raised">
        <div className="flex h-16 items-center px-5">
          <Link href="/" className="font-serif text-[20px] text-ink">
            실라주
          </Link>
        </div>
        <nav className="px-2">
          {NAV.map((n, i) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex min-h-10 items-center justify-between rounded-[8px] px-3 text-[14px] text-body"
            >
              <span>{n.label}</span>
              {i > 0 && n.key && badge[n.key] > 0 && (
                <span className="tabular rounded-full bg-pending px-2 text-[11px] text-on-accent">
                  {badge[n.key]}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-hairline px-5 pt-4 text-[12px] text-muted">
          <div className="flex justify-between py-0.5">
            <span>원두</span>
            <span className="tabular text-body">{stats.products}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span>로스터리</span>
            <span className="tabular text-body">{stats.vendors}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span>기록</span>
            <span className="tabular text-body">{stats.records}</span>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 px-8 py-8">{children}</div>
    </div>
  );
}
