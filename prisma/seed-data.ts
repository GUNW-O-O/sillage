// 시드 데이터. 설계 4-6 · 4-8 대응.
//
// 이 목록은 "시작점"이지 완성본이 아니다 — 사전은 쓰면서 자라는 것이 설계 의도다.
// 어드민에서 추가 · 위치 변경 · 라벨 수정이 가능하므로 (설계 7-4),
// seed 는 재실행해도 어드민이 고친 값을 덮지 않는다 (seed.ts 의 upsert 참고).

export type NodeSeed = {
  id: string;
  labelKo: string;
  labelEn: string;
  children?: NodeSeed[];
};

/// Level 1 은 골격이다. 어드민에서도 추가 · 이동 · 삭제를 막는다 (설계 7-4).
/// Level 3 는 시드하지 않는다 — NoteAlias 의 raw 축적에서 자란다 (설계 4-6).
export const FLAVOR_NODES: NodeSeed[] = [
  {
    id: "fruity",
    labelKo: "과일",
    labelEn: "Fruity",
    children: [
      { id: "berry", labelKo: "베리", labelEn: "Berry" },
      { id: "citrus", labelKo: "시트러스", labelEn: "Citrus" },
      { id: "stone_fruit", labelKo: "핵과", labelEn: "Stone Fruit" },
      { id: "tropical_fruit", labelKo: "열대과일", labelEn: "Tropical Fruit" },
      { id: "dried_fruit", labelKo: "건과일", labelEn: "Dried Fruit" },
      { id: "other_fruit", labelKo: "그 외 과일", labelEn: "Other Fruit" },
    ],
  },
  {
    id: "floral",
    labelKo: "꽃",
    labelEn: "Floral",
    children: [
      { id: "flower", labelKo: "꽃", labelEn: "Flower" },
      // 향으로는 꽃 계열에 가깝고, 국내 로스터리가 자스민과 같은 다발로 자주 쓴다
      { id: "black_tea", labelKo: "홍차", labelEn: "Black Tea" },
    ],
  },
  {
    id: "sweet",
    labelKo: "단맛",
    labelEn: "Sweet",
    children: [
      { id: "brown_sugar", labelKo: "흑설탕", labelEn: "Brown Sugar" },
      { id: "caramel", labelKo: "카라멜", labelEn: "Caramel" },
      { id: "honey", labelKo: "꿀", labelEn: "Honey" },
      { id: "vanilla", labelKo: "바닐라", labelEn: "Vanilla" },
    ],
  },
  {
    id: "nutty_cocoa",
    labelKo: "견과 · 코코아",
    labelEn: "Nutty/Cocoa",
    children: [
      { id: "nutty", labelKo: "견과", labelEn: "Nutty" },
      { id: "cocoa", labelKo: "코코아", labelEn: "Cocoa" },
    ],
  },
  {
    id: "spices",
    labelKo: "향신료",
    labelEn: "Spices",
    children: [
      { id: "warm_spice", labelKo: "따뜻한 향신료", labelEn: "Warm Spice" },
      { id: "pungent_spice", labelKo: "자극적 향신료", labelEn: "Pungent Spice" },
    ],
  },
  {
    id: "roasted",
    labelKo: "로스팅",
    labelEn: "Roasted",
    children: [
      { id: "grain", labelKo: "곡물", labelEn: "Grain" },
      { id: "burnt", labelKo: "탄내", labelEn: "Burnt" },
      { id: "tobacco", labelKo: "담배", labelEn: "Tobacco" },
    ],
  },
  {
    id: "green_vegetative",
    labelKo: "풀 · 식물",
    labelEn: "Green/Vegetative",
    children: [
      { id: "herbal", labelKo: "허브", labelEn: "Herbal" },
      { id: "vegetative", labelKo: "풋내", labelEn: "Vegetative" },
      { id: "woody", labelKo: "나무", labelEn: "Woody" },
    ],
  },
  {
    id: "sour_fermented",
    labelKo: "산미 · 발효",
    labelEn: "Sour/Fermented",
    children: [
      { id: "sour", labelKo: "산미", labelEn: "Sour" },
      { id: "winey", labelKo: "와이니", labelEn: "Winey" },
      { id: "boozy", labelKo: "주류", labelEn: "Boozy" },
      { id: "fermented", labelKo: "발효", labelEn: "Fermented" },
    ],
  },
  {
    id: "other",
    labelKo: "그 외",
    labelEn: "Other",
    children: [
      { id: "papery", labelKo: "종이 · 눅눅", labelEn: "Papery/Musty" },
      { id: "chemical", labelKo: "화학", labelEn: "Chemical" },
      { id: "savory", labelKo: "감칠 · 짭짤", labelEn: "Savory" },
    ],
  },
];

export type LookupSeed = { nameKo: string; nameEn: string; aliases?: string[] };

/// 가공방식. 디카페인은 넣지 않는다 — processId 가 단일 값인데 디카페인은 직교한다
/// (워시드이면서 디카페인인 원두가 흔하다). attributes.decaf 로 받는다.
/// 세미워시드도 넣지 않는다 — 브라질 · 인도네시아 · 중미에서 각각 다른 것을 가리킨다.
export const PROCESSES: LookupSeed[] = [
  { nameKo: "워시드", nameEn: "Washed", aliases: ["수세식", "습식"] },
  { nameKo: "내추럴", nameEn: "Natural", aliases: ["건식", "내츄럴"] },
  { nameKo: "허니", nameEn: "Honey", aliases: ["펄프드 내추럴", "Pulped Natural"] },
  { nameKo: "화이트 허니", nameEn: "White Honey" },
  { nameKo: "옐로우 허니", nameEn: "Yellow Honey" },
  { nameKo: "레드 허니", nameEn: "Red Honey" },
  { nameKo: "블랙 허니", nameEn: "Black Honey" },
  { nameKo: "웻헐드", nameEn: "Wet-hulled", aliases: ["길링 바사", "Giling Basah", "수마트라식"] },
  { nameKo: "무산소 발효", nameEn: "Anaerobic", aliases: ["애너로빅", "혐기발효"] },
  { nameKo: "무산소 내추럴", nameEn: "Anaerobic Natural" },
  { nameKo: "무산소 워시드", nameEn: "Anaerobic Washed" },
  { nameKo: "카보닉 매서레이션", nameEn: "Carbonic Maceration", aliases: ["CM", "카보닉"] },
  { nameKo: "공발효", nameEn: "Co-fermentation", aliases: ["코퍼멘테이션", "코-퍼멘테이션"] },
  { nameKo: "더블 퍼멘테이션", nameEn: "Double Fermentation", aliases: ["이중 발효"] },
  { nameKo: "이스트 발효", nameEn: "Yeast Fermentation", aliases: ["효모 발효"] },
  { nameKo: "락토 발효", nameEn: "Lactic Fermentation", aliases: ["젖산 발효", "락틱"] },
  { nameKo: "몬순드", nameEn: "Monsooned", aliases: ["몬순 말라바르"] },
  { nameKo: "써멀 쇼크", nameEn: "Thermal Shock" },
];

/// 품종. 종(species) · 품종군(group) · 품종이 한 축에 섞여 있다 —
/// "품종별 적중률"을 이 셋에 걸쳐 집계하면 층위가 안 맞는다. 알고 둔다.
/// 롱테일은 인라인 추가(pending)로 자란다 (설계 4-8).
export const VARIETIES: LookupSeed[] = [
  { nameKo: "게이샤", nameEn: "Geisha", aliases: ["게샤", "Gesha"] },
  { nameKo: "SL28", nameEn: "SL28" },
  { nameKo: "SL34", nameEn: "SL34" },
  { nameKo: "SL14", nameEn: "SL14" },
  { nameKo: "부르봉", nameEn: "Bourbon", aliases: ["버본", "버번"] },
  { nameKo: "옐로우 부르봉", nameEn: "Yellow Bourbon", aliases: ["부르봉 아마렐로", "Bourbon Amarelo"] },
  { nameKo: "레드 부르봉", nameEn: "Red Bourbon" },
  // 유전자 검사로 에티오피아 계통임이 밝혀졌다. 이름만 부르봉이라 계열로 묶지 않는다
  { nameKo: "핑크 부르봉", nameEn: "Pink Bourbon" },
  { nameKo: "비야 사르치", nameEn: "Villa Sarchi" },
  { nameKo: "티피카", nameEn: "Typica" },
  { nameKo: "모카", nameEn: "Mokka", aliases: ["모까", "Mocca"] },
  { nameKo: "카투아이", nameEn: "Catuai", aliases: ["카투아이", "까뚜아이"] },
  { nameKo: "옐로우 카투아이", nameEn: "Yellow Catuai" },
  { nameKo: "레드 카투아이", nameEn: "Red Catuai" },
  { nameKo: "카투라", nameEn: "Caturra", aliases: ["까뚜라"] },
  { nameKo: "카티모르", nameEn: "Catimor" },
  { nameKo: "문도 노보", nameEn: "Mundo Novo" },
  { nameKo: "아카이아", nameEn: "Acaia" },
  { nameKo: "파카마라", nameEn: "Pacamara" },
  { nameKo: "파카스", nameEn: "Pacas" },
  { nameKo: "마라고지페", nameEn: "Maragogipe", aliases: ["마라고지페", "마라고지"] },
  { nameKo: "마라카투라", nameEn: "Maracaturra" },
  { nameKo: "에티오피아 재래종", nameEn: "Ethiopian Heirloom", aliases: ["heirloom", "재래종", "에어룸"] },
  { nameKo: "74110", nameEn: "74110" },
  { nameKo: "74112", nameEn: "74112" },
  { nameKo: "74158", nameEn: "74158" },
  { nameKo: "쿠루메", nameEn: "Kurume" },
  { nameKo: "데가", nameEn: "Dega" },
  { nameKo: "웰리쵸", nameEn: "Wolisho", aliases: ["월리쇼", "웰리초"] },
  { nameKo: "카스티요", nameEn: "Castillo" },
  { nameKo: "콜롬비아", nameEn: "Colombia" },
  { nameKo: "타비", nameEn: "Tabi" },
  { nameKo: "세니카페 1", nameEn: "Cenicafé 1" },
  { nameKo: "루메 수단", nameEn: "Rume Sudan" },
  { nameKo: "켄트", nameEn: "Kent" },
  { nameKo: "자바", nameEn: "Java" },
  // Bourbon Pointu 는 Laurina 와 같은 품종이다. 한 행으로 두고 나머지를 alias 로
  { nameKo: "라우리나", nameEn: "Laurina", aliases: ["부르봉 포인투", "Bourbon Pointu"] },
  { nameKo: "시드라", nameEn: "Sidra" },
  { nameKo: "오바타", nameEn: "Obata" },
  { nameKo: "아라라", nameEn: "Arara" },
  { nameKo: "티모르 하이브리드", nameEn: "Timor Hybrid", aliases: ["HdT", "Hibrido de Timor"] },
  { nameKo: "센트로아메리카노", nameEn: "Centroamericano", aliases: ["H1"] },
  { nameKo: "스타마야", nameEn: "Starmaya" },
  { nameKo: "밀레니오", nameEn: "Milenio" },
  // 아래 셋은 품종이 아니라 종(species)이다. 로스터리가 같은 자리에 쓰므로 넣는다
  { nameKo: "로부스타", nameEn: "Robusta", aliases: ["카네포라", "Canephora"] },
  { nameKo: "리베리카", nameEn: "Liberica" },
  { nameKo: "에우제니오이데스", nameEn: "Eugenioides" },
];

/// 커피 생산국. 249개를 가나다순으로 깔면 가나 · 가봉부터 나와 산지가 안 보인다.
/// 이 목록에 든 나라를 목록 위로 올린다 (LookupValue.sortWeight).
/// 앞쪽일수록 가중치가 높다 — 국내에서 흔히 보는 산지 순이다.
export const COFFEE_ORIGINS = [
  "ET", "CO", "BR", "KE", "GT", "PA", "CR", "ID", "HN", "PE",
  "NI", "SV", "RW", "BO", "EC", "MX", "TZ", "BI", "YE", "VN",
  "IN", "PG", "JM", "DO", "CU", "HT", "UG", "ZM", "MW", "CD",
  "CM", "CI", "GH", "TL", "TH", "PH", "MM", "LA", "CN", "TW",
  "VE", "GY", "ZW", "MZ", "MG", "AO", "ST", "AU", "NP", "KH",
] as const;

/// ISO 3166-1 alpha-2. 닫힌 집합이라 인라인 추가를 막는다 (설계 4-8).
/// 한글 · 영문 이름은 손으로 옮기지 않고 ICU(Intl.DisplayNames)에서 뽑는다 —
/// 249개를 전사하면 오탈자가 확실히 난다.
export const COUNTRY_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS",
  "BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN",
  "CO","CR","CU","CV","CW","CX","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE",
  "EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR","GA","GB","GD","GE","GF",
  "GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HM",
  "HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM",
  "JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC",
  "LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK",
  "ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA",
  "NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG",
  "PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RU","RW",
  "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS",
  "ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO",
  "TR","TT","TV","TW","TZ","UA","UG","UM","US","UY","UZ","VA","VC","VE","VG","VI",
  "VN","VU","WF","WS","YE","YT","ZA","ZM","ZW",
] as const;
