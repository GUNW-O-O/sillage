// 아이콘은 한 곳에서만 정의한다. 같은 조작이 화면마다 다른 모양이면 배우는 비용이 는다.
// 24 그리드 · stroke 1.6 · currentColor — 색은 쓰는 쪽이 정한다 (DESIGN 아이콘 규칙).

type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  "aria-hidden": true,
});

/// 편집 시작
export const Pencil = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" strokeLinejoin="round" />
    <path d="M14.5 6.5 17.5 9.5" />
  </svg>
);

/// 닫기 · 되돌리는 취소
export const Close = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
  </svg>
);

/// 지우기
export const Trash = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/// 편집 끝. **취소와 구분해서 쓴다** — 되돌리는 자리에는 Close, 이미 저장된 것을
/// 덮고 나오는 자리에는 Check 다. 같은 X 로 통일하면 저장된 편집을 버리는 줄 안다
export const Check = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M5 12.5 10 17.5 19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
