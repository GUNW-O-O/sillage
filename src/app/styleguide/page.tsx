// 토큰 확인 화면. 표면 단차는 테두리 없이 판단해야 하므로 양쪽을 나란히 둔다.
const STATES = [
  { label: "못 느낌", cls: "border border-hairline text-muted-soft" },
  { label: "모르겠음", cls: "bg-surface-sunken text-muted" },
  { label: "약함", cls: "bg-accent-tint text-accent-pressed" },
  { label: "강함", cls: "bg-accent text-on-accent" },
];

const SURFACES = [
  ["canvas", "bg-canvas"],
  ["raised", "bg-surface-raised"],
  ["card", "bg-surface-card"],
  ["sunken", "bg-surface-sunken"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[14px] font-medium text-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-8">
      <h1 className="font-serif text-[28px] leading-tight tracking-[-0.4px] text-ink">실라주</h1>
      <p className="mt-2 text-[13px] text-muted">
        판매자가 적은 향 노트와 내가 느낀 것을 대조한다
      </p>

      <Section title="판정 4상태 — 채움이 점점 진해진다">
        <div className="flex flex-wrap gap-2">
          {STATES.map((s) => (
            <span
              key={s.label}
              className={`inline-flex min-h-11 items-center rounded-full px-[14px] text-[14px] font-medium ${s.cls}`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </Section>

      <Section title="표면 — 테두리 없이 (이쪽이 실제 판단 기준)">
        <div className="grid grid-cols-4 gap-2">
          {SURFACES.map(([name, cls]) => (
            <div key={name} className={`h-16 rounded-[10px] ${cls}`}>
              <span className="block p-2 text-[11px] text-muted">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="표면 — 헤어라인 있을 때">
        <div className="grid grid-cols-4 gap-2">
          {SURFACES.map(([name, cls]) => (
            <div key={name} className={`h-16 rounded-[10px] border border-hairline ${cls}`} />
          ))}
        </div>
      </Section>

      <Section title="검색 입력">
        <input
          className="h-12 w-full rounded-[10px] bg-surface-sunken px-[14px] text-[16px] text-ink outline-none placeholder:text-muted-soft focus:ring-3 focus:ring-accent-tint"
          placeholder="로스터리 검색"
        />
      </Section>

      <Section title="목록 행">
        <ul>
          {[
            ["에티오피아 구지 무산소", "커피리브레 · 노트 3개"],
            ["케냐 키리냐가 AA", "프릳츠 · 노트 5개"],
          ].map(([name, sub]) => (
            <li key={name} className="min-h-14 border-b border-hairline-soft py-3">
              <div className="text-[17px] font-semibold text-ink">{name}</div>
              <div className="mt-0.5 text-[13px] text-muted">{sub}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="하단 저장 바">
        <div className="rounded-[10px] bg-surface-raised p-4">
          <button className="h-12 w-full rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed">
            저장
          </button>
          <button className="mt-2 h-12 w-full rounded-[10px] border border-hairline bg-canvas text-[16px] font-semibold text-ink">
            취소
          </button>
        </div>
      </Section>

      <Section title="대조 화면 미리보기 — 강조색이 판정에만 쓰인다">
        <div className="rounded-[10px] bg-surface-raised p-4">
          <div className="text-[17px] font-semibold text-ink">에티오피아 구지 무산소</div>
          <div className="mt-0.5 text-[13px] text-muted">커피리브레</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["자스민", "bg-accent text-on-accent"],
              ["청사과", "border border-hairline text-muted-soft"],
              ["홍차", "bg-accent-tint text-accent-pressed"],
              ["열대과일", "bg-surface-sunken text-muted"],
            ].map(([label, cls]) => (
              <span
                key={label}
                className={`inline-flex min-h-11 items-center rounded-full px-[14px] text-[14px] font-medium ${cls}`}
              >
                {label}
              </span>
            ))}
          </div>
          <button className="mt-4 h-12 w-full rounded-[10px] bg-cta text-[16px] font-semibold text-on-cta active:bg-cta-pressed">
            저장
          </button>
        </div>
      </Section>
    </main>
  );
}
