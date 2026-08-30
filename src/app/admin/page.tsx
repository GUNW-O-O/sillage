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
        등록 폼에서 노트 분류를 뺐으므로 미매핑 raw 가 여기 쌓인다. 처리하는 곳이 여기뿐이고,
        비워두면 noteSetHash 가 unmapped 토큰으로 남아 동일성 키가 무의미해진다.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat
          label="미매핑 노트"
          value={String(s.unmapped)}
          hint="붙이거나 지운다"
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
    </main>
  );
}
