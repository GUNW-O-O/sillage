"use client";

import { COLOR_PALETTE } from "@/lib/color-palette";

const NAME_OF = new Map(COLOR_PALETTE.flatMap((g) => g.swatches.map((w) => [w.hex, w.name])));

/// 향 색은 색표에서만 고른다 (src/lib/color-palette.ts). 축 편집과 별칭 색이 같이 쓴다.
///
/// **지금 색을 맨 위에 따로 보인다** — 색표 이전에 고른 값은 목록에 없어서, 여기가
/// 아니면 무엇이 저장돼 있는지 못 읽는다. 비우면 상속이고 그때 무엇이 칠해지는지도 같이 적는다
export function ColorSwatchPicker({
  value,
  inherited,
  onChange,
}: {
  /// 빈 문자열이면 색이 없다(상속)
  value: string;
  /// 비웠을 때 대신 칠해질 색
  inherited: string | null;
  onChange: (hex: string) => void;
}) {
  const v = value.toLowerCase();
  const shown = v || inherited;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          data-testid="picked-color"
          title={shown ?? "색 없음"}
          style={shown ? { backgroundColor: shown } : undefined}
          className={`size-8 shrink-0 rounded-[8px] border ${shown ? "border-hairline" : "border-dashed border-muted-soft"} ${v ? "" : "opacity-60"}`}
        />
        <span className="min-w-0 flex-1 text-[13px] text-body">
          {v
            ? `${NAME_OF.get(v) ?? "색표 밖의 색"} ${v}`
            : inherited
              ? `${inherited} 물려받는 중`
              : "색 없음"}
        </span>
        {v && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="h-9 shrink-0 rounded-[10px] border border-hairline px-3 text-[13px] text-muted"
          >
            비우기
          </button>
        )}
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto rounded-[10px] bg-surface-sunken p-2.5">
        {COLOR_PALETTE.map((g) => (
          <div key={g.name}>
            <div className="mb-1 text-[11px] text-muted">{g.name}</div>
            <div className="flex flex-wrap gap-1">
              {g.swatches.map((w) => (
                <button
                  key={w.name}
                  type="button"
                  aria-label={w.name}
                  aria-pressed={v === w.hex}
                  title={`${w.name} ${w.hex}`}
                  onClick={() => onChange(w.hex)}
                  style={{ backgroundColor: w.hex }}
                  // 흰색 계열(Papery · Jasmine)이 바탕에 묻히지 않게 테두리를 늘 준다
                  className={`size-6 rounded-[6px] border border-hairline ${
                    v === w.hex ? "outline-2 outline-offset-1 outline-ink" : ""
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
