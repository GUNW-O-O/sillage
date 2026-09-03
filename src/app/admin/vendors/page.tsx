import { listVendorsAdmin } from "@/app/actions";
import { AddVendor } from "@/components/admin-create";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const vendors = await listVendorsAdmin();

  return (
    <main className="max-w-[1000px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-[26px] text-ink">로스터리</h1>
          <p className="mt-2 text-[13px] text-muted">
            한 로스터리 아래 제품이 모이면 표기가 튀는 것이 바로 보여요. 감시자가 사람이 아니라
            화면 배치인 셈이에요.
          </p>
        </div>
        <AddVendor />
      </div>

      <table className="mt-6 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline text-[13px] text-muted">
            <th className="py-2 font-medium">이름</th>
            <th className="py-2 font-medium">별칭</th>
            <th className="py-2 font-medium">원두</th>
            <th className="py-2 font-medium">상태</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => (
            <tr key={v.id} className="border-b border-hairline-soft">
              <td className="py-3 text-[16px] text-ink">{v.name}</td>
              <td className="py-3 text-[13px] text-muted">{v.aliases.join(" · ") || "—"}</td>
              <td className="tabular py-3 text-[14px] text-muted">{v.productCount}</td>
              <td className="py-3 text-[13px]">
                {v.status === "PENDING" ? (
                  <span className="text-pending">승인 대기</span>
                ) : (
                  <span className="text-muted-soft">승인됨</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
