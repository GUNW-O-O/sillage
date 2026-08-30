import { listLookupsByKind, listPending } from "@/app/actions";
import { PendingQueue } from "@/components/pending-queue";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const [{ vendors, lookups }, varieties, processes] = await Promise.all([
    listPending(),
    listLookupsByKind("VARIETY"),
    listLookupsByKind("PROCESS"),
  ]);

  return (
    <main className="max-w-[1000px]">
      <h1 className="font-serif text-[26px] text-ink">승인 대기</h1>
      <p className="mt-2 mb-6 text-[13px] text-muted">
        등록 중에 인라인으로 추가된 값이다. DB 에 없다는 이유로 기록이 막히면 그날의 기록이
        사라지므로 일단 받고 여기서 정돈한다. 승인하면 다른 사람 자동완성에도 뜬다.
      </p>
      <PendingQueue
        vendors={vendors}
        lookups={lookups}
        options={{ VARIETY: varieties, PROCESS: processes }}
      />
    </main>
  );
}
