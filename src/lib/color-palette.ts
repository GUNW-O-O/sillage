/// 향 색을 고를 수 있는 색표 — SCA/WCR Coffee Taster's Flavor Wheel (2016) 의 110색.
///
/// **왜 SCA 인가.** 로스터리가 적는 컵노트가 이 휠의 어휘에서 온다. 색도 휠에 맞추면
/// 커피를 아는 사람에게 「빨간 계열 = 과일」이 설명 없이 읽힌다.
/// **왜 자유 입력이 아닌가** (2026-09-16) — 아무 hex 나 받으면 띠에서 한 색만 튀어
/// 그 원두만 다른 앱처럼 보인다.
///
/// 값은 공식 PDF 의 CMYK 를 변환한 근사값이다. 파일에 hex 원본이 없다.
/// 출처와 추출 방법은 `docs/reference/2026-09-16-flavor-color-sources.md` 1장.
///
/// 순서는 휠 그대로 — 안쪽 고리 하나 아래에 중간 · 바깥 고리가 딸린다.
export type Swatch = { name: string; hex: string };
export type SwatchGroup = { name: string; swatches: Swatch[] };

const s = (name: string, hex: string): Swatch => ({ name, hex: hex.toLowerCase() });

export const COLOR_PALETTE: SwatchGroup[] = [
  {
    name: "Fruity",
    swatches: [
      s("Fruity", "#ED1C24"),
      s("Berry", "#EE2F42"),
      s("Blackberry", "#0A091A"),
      s("Raspberry", "#E32E86"),
      s("Blueberry", "#6569AB"),
      s("Strawberry", "#EE2B3C"),
      s("Dried Fruit", "#D5444F"),
      s("Raisin", "#9E2478"),
      s("Prune", "#84558E"),
      s("Other Fruit", "#F26649"),
      s("Coconut", "#E28D2A"),
      s("Cherry", "#E61457"),
      s("Pomegranate", "#EF3F5C"),
      s("Pineapple", "#F99D1C"),
      s("Grape", "#9EC435"),
      s("Apple", "#6BC071"),
      s("Peach", "#F27F51"),
      s("Pear", "#B2A920"),
      s("Citrus Fruit", "#FDB913"),
      s("Grapefruit", "#F15B61"),
      s("Orange", "#F47920"),
      s("Lemon", "#F6D800"),
      s("Lime", "#90C155"),
    ],
  },
  {
    name: "Floral",
    swatches: [
      s("Floral", "#EC008C"),
      s("Black Tea", "#AD667C"),
      s("Floral (middle)", "#EF4C8F"),
      s("Chamomile", "#FCAF26"),
      s("Rose", "#E374A6"),
      s("Jasmine", "#FFFDE9"),
    ],
  },
  {
    name: "Sweet",
    swatches: [
      s("Sweet", "#F26522"),
      s("Brown Sugar", "#CD7C91"),
      s("Molasses", "#230008"),
      s("Maple Syrup", "#D85E26"),
      s("Caramelized", "#DFA128"),
      s("Honey", "#F47D29"),
      s("Vanilla", "#F7987D"),
      s("Vanillin", "#F37F87"),
      s("Overall Sweet", "#DC707A"),
      s("Sweet Aromatics", "#CB3E6C"),
    ],
  },
  {
    name: "Nutty/Cocoa",
    swatches: [
      s("Nutty/Cocoa", "#9A7B79"),
      s("Nutty", "#B69288"),
      s("Peanuts", "#E4B609"),
      s("Hazelnut", "#935F23"),
      s("Almond", "#D9A99C"),
      s("Cocoa", "#B37122"),
      s("Chocolate", "#6B2920"),
      s("Dark Chocolate", "#4A271E"),
    ],
  },
  {
    name: "Spices",
    swatches: [
      s("Spices", "#B81242"),
      s("Pungent", "#724764"),
      s("Pepper", "#DE1A32"),
      s("Brown Spice", "#BC404C"),
      s("Anise", "#C79E1C"),
      s("Nutmeg", "#A61A19"),
      s("Cinnamon", "#E59230"),
      s("Clove", "#B5786D"),
    ],
  },
  {
    name: "Roasted",
    swatches: [
      s("Roasted", "#D33828"),
      s("Pipe Tobacco", "#A49663"),
      s("Tobacco", "#CFB380"),
      s("Burnt", "#B6804D"),
      s("Acrid", "#AFA069"),
      s("Ashy", "#94A893"),
      s("Smoky", "#A87E34"),
      s("Brown, Roast", "#835622"),
      s("Cereal", "#EFC631"),
      s("Grain", "#CFA488"),
      s("Malt", "#EA9A65"),
    ],
  },
  {
    name: "Green/Vegetative",
    swatches: [
      s("Green/Vegetative", "#027F3B"),
      s("Olive Oil", "#A0B028"),
      s("Raw", "#6B8B39"),
      s("Green/Vegetative (middle)", "#0BB152"),
      s("Under-Ripe", "#A8C946"),
      s("Peapod", "#49B44A"),
      s("Fresh", "#00AC6F"),
      s("Dark Green", "#00603E"),
      s("Vegetative", "#09B26A"),
      s("Hay-Like", "#9F9F23"),
      s("Herb-Like", "#7BC258"),
      s("Beany", "#6F9E94"),
    ],
  },
  {
    name: "Sour/Fermented",
    swatches: [
      s("Sour/Fermented", "#F4CD00"),
      s("Sour", "#E0D729"),
      s("Sour Aromatics", "#C0BD1E"),
      s("Acetic Acid", "#9EC58B"),
      s("Butyric Acid", "#D6C408"),
      s("Isovaleric Acid", "#72C059"),
      s("Citric Acid", "#E5D50C"),
      s("Malic Acid", "#B4C425"),
      s("Alcohol/Fermented", "#B0A017"),
      s("Winey", "#A50870"),
      s("Whiskey", "#B03B54"),
      s("Fermented", "#D3A908"),
      s("Overripe", "#7E702A"),
    ],
  },
  {
    name: "Other",
    swatches: [
      s("Other", "#00A6D0"),
      s("Papery/Musty", "#9CBBCB"),
      s("Stale", "#667D6B"),
      s("Cardboard", "#DAC145"),
      s("Papery", "#FFFFFF"),
      s("Woody", "#725C28"),
      s("Moldy/Damp", "#A1AC74"),
      s("Musty/Dusty", "#CBA76A"),
      s("Musty/Earthy", "#948547"),
      s("Animalic", "#A0A277"),
      s("Meaty Brothy", "#CB8178"),
      s("Phenolic", "#E77D88"),
      s("Chemical", "#63C5DB"),
      s("Bitter", "#70C9BF"),
      s("Salty", "#F6FBFE"),
      s("Medicinal", "#61A8C3"),
      s("Petroleum", "#00AAC0"),
      s("Skunky", "#5D8396"),
      s("Rubber", "#001832"),
    ],
  },
];

const ALLOWED = new Set(COLOR_PALETTE.flatMap((g) => g.swatches.map((w) => w.hex)));

/// 저장해도 되는 색인가. 빈 값은 「색 지우기」라 늘 된다.
/// **지금 저장된 색은 색표에 없어도 받는다** — 색표 이전에 손으로 고른 값이 DB 에 있고,
/// 라벨만 고치려는 저장이 그 색 때문에 막히면 안 된다
export function isAllowedColor(hex: string, current: string | null): boolean {
  const v = hex.trim().toLowerCase();
  return v === "" || ALLOWED.has(v) || v === current?.toLowerCase();
}
