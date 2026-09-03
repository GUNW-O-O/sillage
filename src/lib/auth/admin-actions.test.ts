import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { ADMIN_ACTIONS } from "./admin-actions";

// **DB 검사도 브라우저 검사도 이걸 못 본다.** 가드를 안 붙인 액션은 화면에서 안 불리면
// 어느 층에도 나타나지 않는다. 소스를 읽는 것이 유일한 방법이라 순수 함수 층에 둔다 (설계 4-4).
const SRC = readFileSync("src/app/actions.ts", "utf8");

function bodyOf(name: string): string {
  const head = `export async function ${name}(`;
  const start = SRC.indexOf(head);
  if (start < 0) throw new Error(`${name} 가 actions.ts 에 없다. 이름이 바뀌었나`);
  const next = SRC.indexOf("\nexport ", start + head.length);
  return SRC.slice(start, next < 0 ? SRC.length : next);
}

// 시그니처의 끝은 **닫는 괄호 + (있으면) 반환 타입 + 여는 중괄호** 다. 그냥 첫 `{` 를
// 찾으면 구조분해 매개변수(`{ id }`)나 기본값(`= {}`)을 가진 액션에서 시그니처 한복판을
// 본문 시작으로 착각한다 — 지금은 그런 액션이 없지만 틀렸을 때 엉뚱한 줄을 가리킨다.
const SIGNATURE_END = /\)(?::[^\n]*)?\s*\{/;

function signatureOf(name: string): string {
  const body = bodyOf(name);
  const m = body.match(SIGNATURE_END);
  if (!m) throw new Error(`${name} 의 시그니처 끝을 못 찾았다`);
  return body.slice(0, m.index! + m[0].length);
}

// 단순 `toContain` 은 가드를 "언급만 하는 주석"에도, 특권 작업이 끝난 **맨 뒤**에 붙은
// 가드에도 통과한다 — 위치를 안 본다. 그래서 여기서는 서명 줄 다음부터 주석(`//`·`///`)과
// 빈 줄을 걷어내고, **앞 3개 문장 줄** 안에 가드가 있는지를 본다.
// 3인 이유: 가드 실패가 트랜잭션의 `.catch()` 밖에서 reject 로 새는 액션들은
// `try { await requireAdmin(); } catch (e) { ... }` 형태라 가드가 2번째 문장 줄에 온다.
function firstStatementLines(name: string, count: number): string[] {
  const body = bodyOf(name);
  const afterSignature = body.slice(signatureOf(name).length);

  const lines: string[] = [];
  for (const rawLine of afterSignature.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue; // 빈 줄은 건너뛴다
    if (line.startsWith("//")) continue; // 주석 줄 — `//` 도 `///` 도 이 접두사로 잡힌다
    lines.push(line);
    if (lines.length === count) break;
  }
  return lines;
}

it.each(ADMIN_ACTIONS)("%s 가 requireAdmin 을 앞 3개 문장 줄 안에서 부른다", (name) => {
  const lines = firstStatementLines(name, 3);
  // **줄 하나와 통째로 같아야 한다.** 이어붙인 문자열에 `toContain` 을 걸면
  // `if (process.env.NODE_ENV === "production") await requireAdmin();` 같은 조건부 가드도
  // 통과한다 — 조건이 안 맞는 환경에서는 가드가 아예 없는 것과 같다.
  // 배열에 거는 `toContain` 은 원소 전체가 일치해야 하므로 그 형태가 걸린다.
  //
  // 실패하면 vitest 가 받은 값(= 실제 앞 문장 줄)을 그대로 출력한다 —
  // 다음 사람이 왜 실패했는지 그 자리에서 본다
  expect(lines).toContain("await requireAdmin();");
});

// **가드가 있느냐 다음으로, 실패가 어떤 모양으로 나가느냐를 본다.**
// `AdminResult` 를 반환하는 액션은 클라이언트 `run()` 헬퍼가 부르는데 그 헬퍼에는
// try/catch 가 없다 — 가드가 그냥 던지면 unhandled rejection 이 되고 화면이 전환 상태에
// 갇힌다. 기준을 **반환 타입** 으로 잡는다: 호출부를 따라가지 않아도 시그니처만 보고
// 판별되고, 액션을 새로 만들 때 어느 쪽인지 헷갈릴 자리가 없다.
const RESULT_ACTIONS = ADMIN_ACTIONS.filter((name) => signatureOf(name).includes("AdminResult"));

it("AdminResult 를 반환하는 어드민 액션을 실제로 골라냈다", () => {
  // 시그니처 파싱이 조용히 빈 배열을 내면 아래 it.each 가 0건으로 통과한다
  expect(RESULT_ACTIONS.length).toBeGreaterThan(0);
});

it.each(RESULT_ACTIONS)("%s 가 가드 실패를 AdminResult 로 돌려준다", (name) => {
  const lines = firstStatementLines(name, 2);
  expect(lines).toEqual(["try {", "await requireAdmin();"]);
});
