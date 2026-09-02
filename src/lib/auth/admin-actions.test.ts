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

it.each(ADMIN_ACTIONS)("%s 가 requireAdmin 을 부른다", (name) => {
  expect(bodyOf(name)).toContain("await requireAdmin()");
});
