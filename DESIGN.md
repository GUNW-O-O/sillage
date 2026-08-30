---
version: alpha
name: sillage-design
description: 실라주(Sillage) — 향 감각 기록 앱의 디자인 시스템. 폰 우선, 탭 위주, 매일 쓰는 입력 도구다. 따뜻한 크림 캔버스 위에 명조 디스플레이와 산세 본문을 대비시킨다. 로스팅된 원두에서 온 브릭 강조색을 쓰고, 그 강조색은 4상태 순환 칩에서 채움 농도로 두 단계 강도를 표현한다. 마케팅 페이지가 아니라 제품 화면이므로 히어로·CTA 밴드·섹션 리듬이 없다. 화면은 목록·폼·칩·하단 저장 바로 구성된다.

colors:
  # 표면 — 따뜻한 크림. 대부분의 앱이 쓰는 쿨 그레이를 피한다
  canvas: "#faf9f5"
  surface-raised: "#f3eee3"
  surface-card: "#eae1d2"
  surface-sunken: "#ded3c0"
  hairline: "#dcd3c4"
  hairline-soft: "#e9e3d8"

  # 글자
  ink: "#141413"
  body: "#3d3d3a"
  muted: "#6c6a64"
  muted-soft: "#8e8b82"
  on-accent: "#ffffff"

  # 강조 — 로스팅된 원두. 2단 농도가 4상태 칩의 강도를 받는다
  accent: "#9c4a2d"
  accent-pressed: "#7a3722"
  accent-tint: "#f2e0d5"
  accent-disabled: "#ded5cb"

  # CTA — 다크 웜 브라운. 강조색과 역할을 나눈다
  cta: "#453c31"
  cta-pressed: "#2e281f"
  cta-disabled: "#cfc7b9"
  on-cta: "#faf9f5"

  # 판정 4상태 (설계 4-5). 색이 아니라 채움 농도로 갈린다
  hit-strong-bg: "#9c4a2d"
  hit-strong-fg: "#ffffff"
  hit-weak-bg: "#f2e0d5"
  hit-weak-fg: "#7a3722"
  unsure-bg: "#ded3c0"
  unsure-fg: "#6c6a64"
  miss-bg: "transparent"
  miss-fg: "#8e8b82"

  # 상태
  pending: "#a8781f"
  danger: "#a83a2e"
  success: "#4f7f4a"

typography:
  # 디스플레이 — 명조. 앱 이름과 화면 제목에만 쓴다
  display-lg:
    fontFamily: "Noto Serif KR, serif"
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: -0.4px
  display-md:
    fontFamily: "Noto Serif KR, serif"
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: -0.3px
  # 본문 — 산세. 밀도 높은 목록과 폼은 전부 여기
  title:
    fontFamily: "Pretendard, Noto Sans KR, sans-serif"
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Pretendard, Noto Sans KR, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-strong:
    fontFamily: "Pretendard, Noto Sans KR, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.55
  label:
    fontFamily: "Pretendard, Noto Sans KR, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.45
  caption:
    fontFamily: "Pretendard, Noto Sans KR, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  numeric:
    fontFamily: "Pretendard, Noto Sans KR, sans-serif"
    fontSize: 15px
    fontWeight: 500
    fontVariantNumeric: "tabular-nums"

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px

rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px

touch:
  min: 44px
  chip: 44px
  row: 56px
---

## Overview

실라주는 **매일 쓰는 입력 도구**다. 마케팅 페이지가 아니다. 그래서 히어로 밴드도,
96px 섹션 리듬도, 3단 카드 그리드도, 프리푸터 CTA 도 없다. 화면은 넷뿐이다 —
**검색 · 폼 · 칩이 늘어선 대조 화면 · 목록**.

**폰이 기본이고 PC 는 폭만 넓힌 것이다.** 반대로 짜면 폰에서 깨진다.
어드민만 예외로 PC 전용이다.

바탕은 **따뜻한 크림**(`{colors.canvas}`)이다. 커피를 기록하는 도구이므로 대부분의
앱이 쓰는 쿨 그레이를 피한다. 글자는 웜 잉크(`{colors.ink}`), 강조는 로스팅된 원두에서
온 브릭(`{colors.accent}`)이다.

타입은 **명조 디스플레이 + 산세 본문**으로 갈린다. 명조는 앱 이름과 화면 제목에만
쓰고, 밀도 높은 목록 · 폼 · 칩은 전부 산세다. 한글 명조를 14~16px 로 깔면 폰에서
읽기가 나빠진다 — 대비를 얻으려고 가독성을 내주지 않는다.

**핵심 특징**

- 4상태 순환 칩이 이 앱의 중심 컴포넌트다. 색상이 아니라 **채움 농도**로 갈린다 —
색각 이상에서도 구분되고, 칩에는 항상 라벨이 붙는다
- 그림자를 거의 쓰지 않는다. 깊이는 **1px 헤어라인**과 표면 톤 차이로 만든다.
목록 밀도가 높아 그림자를 쓰면 화면이 지저분해진다
- 터치 타겟은 **44px 하한**이다. 4상태 순환은 오탭 복구가 3탭이라 특히 그렇다
- **hover 를 정의하지 않는다.** 기본과 눌림 상태만 둔다. 주 입력이 손가락이다

## Colors

### 표면

**`{colors.canvas}` 는 바닥이지 표면이 아니다.** 얹히는 것은 셋뿐이다.

- **`{colors.canvas}`** #faf9f5 — 화면 바닥
- **`{colors.surface-raised}`** #f3eee3 — 상단 바, 하단 저장 바
- **`{colors.surface-card}`** #eae1d2 — 목록 행 강조, 접힌 영역
- **`{colors.surface-sunken}`** #ded3c0 — 입력 배경, 중립 칩

**단차를 넓게 잡는다.** 좁으면 헤어라인 없이 구분이 안 되고, 특히 `sunken` 을 쓰는
`모르겠음` 칩이 `못 느낌`(투명 배경)과 뭉갠다 — 판정 4상태가 채움 농도로 갈리므로
표면 단차가 곧 판정 가독성이다. **표면은 테두리 없는 상태로 판단한다.**

### 글자

- **`{colors.ink}`** #141413 — 제목, 제품명
- **`{colors.body}`** #3d3d3a — 본문
- **`{colors.muted}`** #6c6a64 — 보조 정보(로스터리명, 표본 수)
- **`{colors.muted-soft}`** #8e8b82 — 비활성, 플레이스홀더

### 강조 — 판정에만 쓴다

- **`{colors.accent}`** #9c4a2d — `강함` 칩, 선택된 lookup 칩
- **`{colors.accent-pressed}`** #7a3722 — `약함` 칩의 글자, 눌림
- **`{colors.accent-tint}`** #f2e0d5 — `약함` 칩의 채움

**강조색은 판정 강도 하나만 뜻한다.** 대조 화면에 `강함` 칩이 여러 개 뜨는데
저장 버튼까지 같은 색이면 신호가 경쟁한다. 그래서 CTA 를 무채색으로 내렸다.

### CTA — 다크 웜 브라운

- **`{colors.cta}`** #453c31 — 저장 버튼
- **`{colors.cta-pressed}`** #2e281f — 눌림
- **`{colors.on-cta}`** #faf9f5 — 버튼 위 글자

색상이 아니라 **역할**로 이름 지었다. 강조색을 판정에 온전히 넘기되, 무채색 잉크로는
가지 않는다 — 대비 16:1 이 웜/탠 팔레트에서 혼자 차갑게 튀고, 하단 저장 바가 폭
전체를 채우는 큰 블록이라 그 무게가 그대로 드러난다. **명도를 낮추되 색온도는
팔레트 안에 둔다.**

### 판정 4상태 (설계 4-5)

| 값 | 배경 | 글자 | 테두리 |
|---|---|---|---|
| `못 느낌` (MISS · 초기값) | 없음 | `{colors.miss-fg}` | 1px `{colors.hairline}` |
| `모르겠음` (UNSURE) | `{colors.unsure-bg}` | `{colors.unsure-fg}` | 없음 |
| `약함` (HIT 1) | `{colors.hit-weak-bg}` | `{colors.hit-weak-fg}` | 없음 |
| `강함` (HIT 2) | `{colors.hit-strong-bg}` | `{colors.hit-strong-fg}` | 없음 |

**채움이 점점 진해진다** — 빈 것 → 회색 채움 → 연한 강조 → 진한 강조.
값의 순서가 시각적 무게와 일치하므로 순환 방향이 몸에 붙는다.

### 상태

- **`{colors.pending}`** #a8781f — 승인 대기(인라인 추가한 로스터리 · 품종 · 가공)
- **`{colors.danger}`** #a83a2e — 삭제
- **`{colors.success}`** #4f7f4a — 저장 완료

## Typography

### 폰트

- **디스플레이 — Noto Serif KR.** 앱 이름, 화면 제목. weight 500
- **본문 — Pretendard.** 대안 Noto Sans KR. 목록 · 폼 · 칩 · 버튼 전부

`next/font` 로 셀프 호스팅한다. **한글 웹폰트는 무겁다** — 명조를 디스플레이 두 단계로
제한한 실질적 이유가 이것이다.

### 위계

`display-lg` 28 · `display-md` 22 (명조) — `title` 17 · `body` 16 · `label` 14 ·
`caption` 13 (산세)

### 원칙

- **입력 폰트는 16px 밑으로 내려가지 않는다.** 미만이면 iOS 가 포커스 시 화면을 확대한다
- 강조는 **크기 먼저, 굵기 나중**이다
- 숫자(적중률 · 표본 수)는 `tabular-nums`. 목록에서 자릿수가 흔들리면 읽기 어렵다
- 명조를 본문에 쓰지 않는다

## Layout

### 간격

4px 베이스. `xxs` 4 · `xs` 8 · `sm` 12 · `md` 16 · `lg` 24 · `xl` 32.

**섹션 리듬이 없다.** 화면 좌우 여백은 `{spacing.md}` 16px 고정, 블록 사이는
`{spacing.lg}` 24px 이다. 마케팅 페이지의 96px 리듬은 여기 해당 없다.

### 화면 골격

```
상단 바        고정. 뒤로가기 · 제목 · 우측 액션 1개
본문           스크롤. 좌우 16px
하단 저장 바   고정. safe-area-inset-bottom 만큼 더 띄운다
```

- 높이 단위는 **`100dvh`**. `100vh` 는 주소창 때문에 어긋난다
- 하단 고정 요소에 `env(safe-area-inset-bottom)` 을 더한다 — 저장 버튼이 홈
인디케이터에 가리면 안 된다
- 키보드가 올라올 때 제품명 · 노트 입력칸을 가리지 않는다
- PC 는 본문 최대 폭 **560px 중앙 정렬**. 열을 늘리지 않는다. 어드민만 예외로 넓은 표

## Elevation

| 단계 | 처리 | 용도 |
|---|---|---|
| 평면 | 없음 | 본문 대부분 |
| 헤어라인 | 1px `{colors.hairline}` | 목록 행 구분, 입력, 칩(MISS) |
| 표면 톤 | `{colors.surface-raised}` 배경 | 상단 바, 하단 저장 바 |
| 그림자 | `0 2px 8px rgba(20,20,19,.08)` | **떠 있는 것만** — 자동완성 드롭다운, 시트 |

**그림자를 카드에 쓰지 않는다.** 목록 밀도가 높아 금방 지저분해진다.

## Components

### `app-bar`

높이 56px, 배경 `{colors.surface-raised}`, 하단 1px `{colors.hairline}`.
제목은 `{typography.title}`. 화면 제목이 앱 정체성을 드러내는 자리(홈)에서만
`{typography.display-md}` 명조.

### `search-input`

높이 **48px**, 배경 `{colors.surface-sunken}`, 테두리 없음, radius `{rounded.md}`,
글자 `{typography.body}` 16px, 좌우 패딩 14px. 좌측 검색 아이콘 20px.

**`search-input-focused`** — 1px `{colors.accent}` 테두리 + 3px `{colors.accent-tint}` 링.

흐름의 유일한 진입점이다 (요구 R1). 화면 최상단에 두고 자동 포커스한다.

### `list-row`

최소 높이 **`{touch.row}`** 56px, 세로 패딩 12px, 하단 1px `{colors.hairline-soft}`.

```
제품명                    {typography.title} · {colors.ink}
로스터리 · 노트 3개        {typography.caption} · {colors.muted}
```

**`list-row-pending`** — 좌측에 3px `{colors.pending}` 세로 바. 승인 대기 값이 붙은 행.

### `note-chip` — 이 앱의 중심

최소 **44 × 44px**, radius `{rounded.pill}`, 좌우 패딩 14px, 글자 `{typography.label}`.
탭하면 다음 상태로 순환한다. 상태별 색은 「판정 4상태」 표.

```
[ 자스민 ]  [ 청사과 ]  [ 홍차 ]
   강함        못 느낌     약함
```

- **라벨을 항상 함께 표시한다.** 색만으로 상태를 표현하지 않는다
- 칩 사이 간격 `{spacing.xs}` 8px. 줄바꿈으로 흐른다
- 상태 전환에 애니메이션을 넣지 않는다 — 연타가 전제라 지연이 오조작을 만든다

### `form-field`

라벨 `{typography.label}` · `{colors.muted}`, 아래 8px, 입력은 `search-input` 과 같은 규격.
**필수 표시를 하지 않는다** — 필수가 셋뿐이고 접힌 영역은 전부 선택이라 자명하다.

### `collapsible`

접힌 상태: 높이 48px, 배경 `{colors.surface-card}`, radius `{rounded.md}`,
`[ 상세 정보 ▾ ]` `{typography.label}`.

등록 폼의 나라 · 지역 · 품종 · 가공 · 가향이 여기 들어간다. **채우면 얻는 것을
한 줄로 적는다** — "나라를 채우면 나라별 비교에 나타납니다".

### `chip-select`

lookup 선택(품종 · 가공). `note-chip` 과 같은 크기지만 선택 상태만 2단이다 —
선택: 배경 `{colors.accent}` · 글자 `{colors.on-accent}` / 비선택: 1px 헤어라인.

**`chip-add`** — `+ 직접 입력`. 점선 헤어라인. 눌러도 화면을 벗어나지 않는다 (설계 4-8).

### `bottom-bar`

하단 고정. 배경 `{colors.surface-raised}`, 상단 1px `{colors.hairline}`,
패딩 `{spacing.md}` + `env(safe-area-inset-bottom)`.

**`button-primary`** — 높이 **48px**, 폭 100%, 배경 `{colors.cta}`,
글자 `{colors.on-cta}` `{typography.body-strong}`, radius `{rounded.md}`.
눌림은 `{colors.cta-pressed}`. **강조색을 쓰지 않는다** — 판정 칩과 경쟁한다.
무채색 잉크도 쓰지 않는다 — 팔레트에서 튄다.

**`button-secondary`** — 배경 `{colors.canvas}`, 1px `{colors.hairline}`, 글자 `{colors.ink}`.

**`button-danger-text`** — 배경 없음, 글자 `{colors.danger}`. 기록 삭제 등.

### `empty-state`

`{typography.body}` · `{colors.muted}` 한 줄 + 다음 행동 버튼 하나.
삽화를 쓰지 않는다. 혼자 쓰는 도구라 빈 화면을 볼 일이 며칠뿐이다.

### `admin-table`

PC 전용. 행 높이 44px, 헤어라인 구분, 헤더 `{typography.label}` · `{colors.muted}`.
미매핑 `raw` 큐가 주 화면이다 — `raw` 를 모아 보여주고 행마다
**붙이기(노드 선택) · 지우기** 두 액션.

## Do / Don't

### Do

- 폰부터 짜고 PC 는 폭만 넓힌다
- 터치 타겟 44px 하한을 지킨다. 특히 `note-chip`
- 깊이를 헤어라인과 표면 톤으로 만든다
- 명조는 앱 이름과 화면 제목에만 쓴다
- 강조색은 판정에만 쓴다. CTA 는 무채색이다
- 표면 단차는 **테두리 없는 상태**로 판단한다
- 판정 상태에 라벨을 항상 붙인다
- 기본과 눌림 상태만 정의한다

### Don't

- 히어로 · CTA 밴드 · 섹션 리듬 · 다단 카드 그리드를 만들지 않는다.
**이건 제품 화면이지 랜딩이 아니다**
- 카드에 그림자를 쓰지 않는다
- 본문에 명조를 쓰지 않는다
- 입력 폰트를 16px 밑으로 내리지 않는다
- 색만으로 판정 상태를 표현하지 않는다
- 칩 상태 전환에 애니메이션을 넣지 않는다
- 크림 · 브릭 외에 네 번째 표면 톤을 들이지 않는다
- 저장 버튼에 강조색을 쓰지 않는다
- 기록 경로에 확인 다이얼로그를 넣지 않는다 (설계 7-2)

## Responsive

| 폭 | 처리 |
|---|---|
| < 600px | 기본. 본문 폭 100%, 좌우 16px |
| 600 ~ 1024px | 본문 560px 중앙 정렬. 열을 늘리지 않는다 |
| > 1024px | 같음. 어드민만 넓은 표로 확장 |

**열을 늘리지 않는 이유** — 목록과 폼뿐이라 늘릴 것이 없다. 폭만 제한하고
같은 레이아웃을 쓰면 폰과 PC 의 조작 기억이 갈리지 않는다.

## Known Gaps

- **축 페이지(설계 7-3)의 시각화**가 없다. 적중률 · 표본 수 표시가 3차에 들어오면
숫자 표현 · 막대 · 축 라벨 규격을 여기 추가한다
- **한글 웹폰트 용량**을 실측하지 않았다. 명조를 두 단계로 제한했지만 첫 로드 비용을
재보고 필요하면 디스플레이를 시스템 명조 폴백으로 내린다
- **Pretendard 대 Noto Sans KR** 을 확정하지 않았다. Pretendard 가 UI 에 낫지만
`next/font/local` 설정이 한 단계 는다
- **다크 모드**를 정하지 않았다. 크림 캔버스가 정체성이라 단순 반전이 성립하지 않는다.
필요해지면 별도로 설계한다
- 애니메이션 · 전환 타이밍은 범위 밖이다. 칩만 "없음"으로 명시했다
