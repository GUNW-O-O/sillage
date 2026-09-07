import Link from "next/link";

import { adminStats } from "@/app/actions";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  hint,
  href,
  urgent,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
  urgent?: boolean;
}) {
  const body = (
    <div
      className={`rounded-[10px] border p-4 ${
        urgent ? "border-pending bg-surface-card" : "border-hairline bg-surface-raised"
      }`}
    >
      <div className="text-[13px] text-muted">{label}</div>
      <div className="tabular mt-1 text-[28px] leading-none text-ink">{value}</div>
      <div className="mt-2 text-[12px] text-muted">{hint}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminOverview() {
  const s = await adminStats();
  const total = s.mapped + s.unmapped;
  const rate = total === 0 ? 0 : Math.round((s.mapped / total) * 100);

  return (
    <main className="max-w-[1000px]">
      <h1 className="font-serif text-[26px] text-ink">개요</h1>
      <p className="mt-2 text-[13px] text-muted">
        등록 폼에는 노트 분류가 없어요. 그래서 미매핑 raw 가 여기 쌓이고, 처리하는 곳도 여기뿐이에요.
        비워두면 noteSetHash 에 unmapped 토큰이 남아 동일성 키가 무의미해져요.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat
          label="미매핑 노트"
          value={String(s.unmapped)}
          hint="붙이거나 지워요"
          href="/admin/unmapped"
          urgent={s.unmapped > 0}
        />
        <Stat
          label="승인 대기"
          value={String(s.pendingVendors + s.pendingLookups)}
          hint={`로스터리 ${s.pendingVendors} · lookup ${s.pendingLookups}`}
          href="/admin/pending"
          urgent={s.pendingVendors + s.pendingLookups > 0}
        />
        <Stat label="노트 매핑률" value={`${rate}%`} hint={`${s.mapped} / ${total}`} />
      </div>

      {/* 요구 FR-8. **스키마를 바꾸기 전에 여기서 받아 둔다** — 파괴적 마이그레이션 뒤에는
          되돌릴 방법이 없다. Link 가 아니라 a 다: Link 는 클라이언트 라우팅이라
          파일 응답을 받지 못한다 */}
      <section className="mt-10 border-t border-hairline pt-6">
        <h2 className="text-[15px] text-ink">내보내기</h2>
        <p className="mt-1 text-[13px] text-muted">
          기록 · 원두 · 향 계층까지 전부 담은 JSON 을 받아요. 스키마를 바꾸기 전에 받아 두세요.
        </p>
        <a
          href="/admin/export"
          download
          className="mt-3 inline-flex min-h-10 items-center rounded-[8px] bg-accent px-4 text-[14px] text-on-accent"
        >
          전량 내보내기
        </a>
      </section>
    </main>
  );
}
