import { listNoteProposals } from "@/app/actions";
import { ProposalQueue } from "@/components/proposal-queue";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const proposals = await listNoteProposals();

  return (
    <main className="max-w-[1000px]">
      <h1 className="font-serif text-[26px] text-ink">노트 제안</h1>
      <p className="mt-2 mb-6 text-[13px] text-muted">
        사용자가 낸 <span className="text-ink">빠진 노트</span> 제안이다. 같은 표현을 여러 명이
        내면 동의로 묶인다. 올리면 그 원두의 noteSetHash 가 재계산되고, 결과가 다른 원두와
        같아지면 적용하지 않고 알린다. <span className="text-ink">자동 승격은 없다</span> —
        임계값은 사람이 붙어 실제 분포를 본 뒤에 정한다.
      </p>
      <ProposalQueue proposals={proposals} />
    </main>
  );
}
