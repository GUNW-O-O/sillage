import { expect, test } from "@playwright/test";

import {
  addChip,
  cleanup,
  clickUntil,
  icon,
  openSheet,
  prisma,
  seedProduct,
  seedRecord,
  TAG,
  USER,
} from "./helpers";

// 기록 흐름 전량 — 목록에서 열기 · 4상태 순환 · 내가 느낀 향 · 저장 · 삭제.
// 이 화면들은 전부 클라이언트 상태로 돌아 응답 코드로는 아무것도 확인되지 않는다.

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("목록에서 기록을 열고 판정을 고쳐 저장한다", async ({ page }) => {
  const p = await seedProduct("알파", [
    { raw: "자스민", nodeId: "flower" },
    { raw: "청사과", nodeId: "other_fruit" },
  ]);
  await seedRecord(p.id, [{ sellerNoteId: p.sellerNotes[0].id, value: "STRONG" }]);

  await page.goto("/");
  await openSheet(page, p.name);

  // 시트가 열렸다. 저장된 판정이 그대로 보인다
  await expect(page.getByText("강함").first()).toBeVisible();

  // 수정 모드로 들어가 안 찍힌 노트를 한 번 탭한다 — MISS → UNSURE
  await clickUntil(icon(page, "수정"), page.getByText("느낀 것만 눌러 주세요"));
  await page.getByRole("button", { name: "청사과" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();

  await expect
    .poll(async () => {
      const hit = await prisma.noteHit.findFirst({
        where: { sellerNoteId: p.sellerNotes[1].id },
        select: { value: true },
      });
      return hit?.value ?? null;
    })
    .toBe("UNSURE");
});

test("안 찍은 노트는 못 느낌으로 저장된다", async ({ page }) => {
  const p = await seedProduct("베타", [
    { raw: "베르가못", nodeId: "citrus" },
    { raw: "홍차", nodeId: "black_tea" },
  ]);

  await page.goto(`/products/${p.id}/record`);
  // 아무것도 안 건드리고 저장한다. 4-5 의 "안 건드림 = 못 느낌"
  await clickUntil(icon(page, "기록 저장"), page.getByRole("heading", { name: "실라주" }));

  await expect
    .poll(async () =>
      prisma.noteHit.count({
        where: { experience: { productId: p.id }, value: "MISS" },
      }),
    )
    .toBe(2);
});

test("내가 느낀 향을 적고 저장하면 기록에 붙는다", async ({ page }) => {
  const p = await seedProduct("감마", [{ raw: "자스민", nodeId: "flower" }]);

  await page.goto(`/products/${p.id}/record`);
  await expect(page.getByText("내가 느낀 향")).toBeVisible();

  await addChip(page, "느낀 향을 하나씩", "흙내");

  await clickUntil(icon(page, "기록 저장"), page.getByRole("heading", { name: "실라주" }));

  await expect
    .poll(async () =>
      prisma.extraNote.count({ where: { experience: { productId: p.id }, raw: "흙내" } }),
    )
    .toBe(1);
});

test("자동완성에 없는 향도 저장되고 미매핑으로 남는다", async ({ page }) => {
  const p = await seedProduct("델타", [{ raw: "자스민", nodeId: "flower" }]);

  await page.goto(`/products/${p.id}/record`);
  await addChip(page, "느낀 향을 하나씩", `없는표현 ${TAG}`);
  await clickUntil(icon(page, "기록 저장"), page.getByRole("heading", { name: "실라주" }));

  await expect
    .poll(async () => {
      const n = await prisma.extraNote.findFirst({
        where: { experience: { productId: p.id } },
        select: { nodeId: true },
      });
      return n === null ? "없음" : n.nodeId;
    })
    .toBe(null);
});

test("기록을 지우면 판정도 함께 사라진다", async ({ page }) => {
  const p = await seedProduct("엡실론", [{ raw: "자스민", nodeId: "flower" }]);
  await seedRecord(p.id, [{ sellerNoteId: p.sellerNotes[0].id, value: "WEAK" }]);

  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await openSheet(page, p.name);
  await icon(page, "삭제").click();

  await expect.poll(() => prisma.experience.count({ where: { productId: p.id } })).toBe(0);
  await expect.poll(() => prisma.noteHit.count({ where: { sellerNote: { productId: p.id } } })).toBe(
    0,
  );
});

test("같은 원두를 다시 열면 새 기록이 아니라 기존 기록이 열린다", async ({ page }) => {
  const p = await seedProduct("제타", [{ raw: "자스민", nodeId: "flower" }]);
  await seedRecord(p.id, [{ sellerNoteId: p.sellerNotes[0].id, value: "STRONG" }]);

  await page.goto(`/products/${p.id}/record`);
  // 기록이 이미 있으면 버튼 문구가 바뀐다
  await expect(page.getByRole("button", { name: "기록 고치기" })).toBeVisible();
  await clickUntil(icon(page, "기록 고치기"), page.getByRole("heading", { name: "실라주" }));

  expect(await prisma.experience.count({ where: { productId: p.id, userId: USER } })).toBe(1);
});
