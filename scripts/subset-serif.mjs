// 명조 서브셋 생성. `npm run font:subset` 로 돌린다.
//
// 왜 필요한가 — Noto Serif KR 의 한글 서브셋은 1MB 단일 파일이고 unicode-range
// 분할이 없다. Pretendard 처럼 조각내서 받을 수 없다는 뜻이다. 그런데 명조는
// 앱 이름과 화면 제목에만 쓰므로(DESIGN.md) 실제 필요한 글자는 100자 미만이다.
//
// 규칙 — 명조로 표시할 문자열을 늘리면 GLYPHS 에 추가하고 이 스크립트를 다시 돌린다.
// 여기 없는 글자는 산세로 폴백된다. 그래서 **명조는 고정 문자열에만 쓴다.**

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import subsetFont from "subset-font";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE = resolve(
  root,
  "node_modules/@fontsource/noto-serif-kr/files/noto-serif-kr-korean-500-normal.woff2",
);
const OUT = resolve(root, "src/app/fonts/sillage-serif.woff2");

// 명조로 찍히는 문자열 전량. 화면 제목이 늘면 여기에 추가한다.
const STRINGS = [
  "실라주", // 앱 이름
  "기록",
  "등록",
  "검색",
  "로스터리",
  "원두",
  "노트",
  "대조",
  "어드민",
  "설정",
  "내보내기",
  "미매핑",
  "향 감각 기록",
  "다음에 뭐 사지",
  "Sillage",
  // 어드민 화면 제목
  "개요",
  "계정",
  "노트 제안",
  "품종 · 가공",
  "향 계층",
  "승인 대기",
  "미매핑 노트",
  "원두 노트",
  // 확인 · 안내 화면
  "이 원두로 기록할까요?",
  "이 원두를 다시 볼까요?",
  "찾는 페이지가 없어요",
  "문제가 생겼어요",
];

const GLYPHS = [...new Set([...STRINGS.join(""), ..."0123456789·— "])].join("");

const source = await readFile(SOURCE);
const subset = await subsetFont(source, GLYPHS, { targetFormat: "woff2" });

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, subset);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`글자 ${[...GLYPHS].length}자`);
console.log(`${kb(source.length)} → ${kb(subset.length)}`);
