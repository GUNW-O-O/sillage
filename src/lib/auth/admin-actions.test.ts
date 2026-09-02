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

// 단순 `toContain` 은 가드를 "언급만 하는 주석"에도, 특권 작업이 끝난 **맨 뒤**에 붙은
// 가드에도 통과한다 — 위치를 안 본다. 그래서 여기서는 서명 줄 다음부터 주석(`//`·`///`)과
// 빈 줄을 걷어내고, **앞 3개 문장 줄** 안에 가드가 있는지를 본다.
// 3인 이유: 가드 실패가 트랜잭션의 `.catch()` 밖에서 reject 로 새는 액션들은
// `try { await requireAdmin(); } catch (e) { ... }` 형태라 가드가 2번째 문장 줄에 온다.
function firstStatementLines(name: string, count: number): string[] {
  const body = bodyOf(name);
  const braceIndex = body.indexOf("{");
  if (braceIndex < 0) throw new Error(`${name} 의 본문 여는 중괄호를 못 찾았다`);
  const afterSignature = body.slice(braceIndex + 1);

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
  // toContain 이 실패하면 vitest 가 받은 값(= 실제 앞 문장 줄)을 그대로 출력한다 —
  // 다음 사람이 왜 실패했는지 그 자리에서 본다
  expect(lines.join("\n")).toContain("await requireAdmin();");
});
