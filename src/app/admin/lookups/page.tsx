import { listLookupsAdmin } from "@/app/actions";
import { AddLookup } from "@/components/admin-create";

// country 는 닫힌 집합이라 추가를 막는다. 조회만 붙인다 (설계 4-8).
export const dynamic = "force-dynamic";

export default async function LookupsPage() {
  const [varieties, processes] = await Promise.all([
    listLookupsAdmin("VARIETY"),
    listLookupsAdmin("PROCESS"),
  ]);

  const Table = ({ rows }: { rows: typeof varieties }) => (
    <table className="mt-3 w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-hairline text-[13px] text-muted">
          <th className="py-2 font-medium">이름</th>
          <th className="py-2 font-medium">영문</th>
          <th className="py-2 font-medium">별칭</th>
          <th className="py-2 font-medium">상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-hairline-soft">
            <td className="py-2.5 text-[15px] text-ink">{r.nameKo}</td>
            <td className="py-2.5 text-[13px] text-muted">{r.nameEn ?? "—"}</td>
            <td className="py-2.5 text-[13px] text-muted">{r.aliases.join(" · ") || "—"}</td>
            <td className="py-2.5 text-[13px]">
              {r.status === "PENDING" ? (
                <span className="text-pending">대기</span>
              ) : (
                <span className="text-muted-soft">승인됨</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <main className="max-w-[1000px]">
      <h1 className="font-serif text-[26px] text-ink">품종 · 가공</h1>
      <p className="mt-2 text-[13px] text-muted">
        롱테일이 실재하는 축이다. 닫힌 목록으로 두면 반드시 막히므로 인라인 추가를 열어두고
        여기서 정돈한다 (설계 4-8). 나라는 ISO 닫힌 집합이라 추가하지 않는다.
      </p>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-ink">
            품종 <span className="tabular text-muted">{varieties.length}</span>
          </h2>
          <AddLookup kind="VARIETY" label="품종" />
        </div>
        <Table rows={varieties} />
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-ink">
            가공 <span className="tabular text-muted">{processes.length}</span>
          </h2>
          <AddLookup kind="PROCESS" label="가공" />
        </div>
        <Table rows={processes} />
      </section>
    </main>
  );
}
