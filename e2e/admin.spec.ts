import { devices, expect, test } from "@playwright/test";

import {
  addChip,
  cleanup,
  clickUntil,
  clickUntilDb,
  prisma,
  seedProduct,
  TAG,
  typeAndClick,
  USER,
} from "./helpers";
import { normalizeName } from "../src/lib/normalize";

// 어드민 화면 전량 — 제안 큐 · 미매핑 큐 · 원두 노트.
//
// **데스크톱 뷰포트로 돌린다.** 어드민은 PC 전용이고 반응형 대상이 아니다 (설계 7-4).
// 폰 폭에서는 220px 사이드바와 본문이 겹쳐 클릭이 가로막힌다 — 그것은 앱의 결함이 아니라
// 안 만들기로 한 화면 크기다.
test.use({ ...devices["Desktop Chrome"] });

test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("어드민이 제안을 노트로 올린다", async ({ page }) => {
  const p = await seedProduct("파이", [{ raw: "자스민", nodeId: "flower" }]);
  await prisma.sellerNoteProposal.create({
    data: {
      productId: p.id,
      raw: `핵과 ${TAG}`,
      normalizedRaw: normalizeName(`핵과 ${TAG}`),
      nodeId: "stone_fruit",
      createdById: USER,
    },
  });

  await page.goto("/admin/proposals");
  await expect(page.getByText(`핵과 ${TAG}`)).toBeVisible();
  await clickUntilDb(
    page.getByRole("button", { name: "노트로 올리기" }),
    async () => (await prisma.sellerNote.count({ where: { productId: p.id } })) === 2,
  );

  expect(await prisma.sellerNoteProposal.count({ where: { productId: p.id } })).toBe(0);
});

test("어드민이 제안을 지운다", async ({ page }) => {
  const p = await seedProduct("로", [{ raw: "자스민", nodeId: "flower" }]);
  await prisma.sellerNoteProposal.create({
    data: {
      productId: p.id,
      raw: `쥬시 ${TAG}`,
      normalizedRaw: normalizeName(`쥬시 ${TAG}`),
      nodeId: null,
      createdById: USER,
    },
  });

  page.on("dialog", (d) => d.accept());
  await page.goto("/admin/proposals");
  await clickUntilDb(
    page.getByRole("button", { name: "지우기" }),
    async () => (await prisma.sellerNoteProposal.count({ where: { productId: p.id } })) === 0,
  );
  // 지운 제안은 노트가 되지 않는다
  expect(await prisma.sellerNote.count({ where: { productId: p.id } })).toBe(1);
});

test("미매핑 큐에서 raw 에 축을 붙이면 판매자 노트와 내 기록이 함께 붙는다", async ({ page }) => {
  const raw = `젖은판지 ${TAG}`;
  const p = await seedProduct("업실론", [{ raw, nodeId: null }]);
  const exp = await prisma.experience.create({
    data: { userId: USER, productId: p.id, extraNotes: { create: [{ raw, nodeId: null }] } },
    select: { id: true },
  });

  await page.goto("/admin/unmapped");
  await expect(page.getByText(raw).first()).toBeVisible();
  // 출처가 구분돼 보인다 — 판매자의 주장인지 내가 느낀 것인지
  await expect(page.getByText("내 기록").first()).toBeVisible();

  await clickUntil(
    page.getByRole("row").filter({ hasText: raw }).getByRole("button", { name: "붙이기" }),
    page.getByText("어느 축에 붙일까"),
  );
  // 모달의 L2 칩을 누르는 순간 붙는다. 확인 버튼이 따로 없다
  await clickUntilDb(
    // 축의 라벨이 `홍차` 에서 `차` 로 넓어졌다 (설계 2026-09-08 §5). id 는 그대로다
    page.getByRole("button", { name: "차", exact: true }),
    async () =>
      (await prisma.sellerNote.count({ where: { productId: p.id, nodeId: "black_tea" } })) === 1,
  );

  // 같은 표현의 내가 느낀 향도 함께 붙는다 — 사전이 하나이므로 결과도 하나여야 한다
  const extra = await prisma.extraNote.findFirstOrThrow({
    where: { experienceId: exp.id },
    select: { nodeId: true },
  });
  expect(extra.nodeId).toBe("black_tea");
});

test("미매핑 큐에서 향미가 아닌 표현을 지운다", async ({ page }) => {
  const raw = `클린컵 ${TAG}`;
  const p = await seedProduct("오미크론", [
    { raw: "자스민", nodeId: "flower" },
    { raw, nodeId: null },
  ]);

  page.on("dialog", (d) => d.accept());
  await page.goto("/admin/unmapped");
  await clickUntilDb(
    page.getByRole("row").filter({ hasText: raw }).getByRole("button", { name: "지우기" }),
    async () => (await prisma.sellerNote.count({ where: { productId: p.id } })) === 1,
  );
});

test("어드민이 원두를 찾아 노트를 추가한다", async ({ page }) => {
  const p = await seedProduct("프시", [{ raw: "자스민", nodeId: "flower" }]);

  await page.goto("/admin/products");
  await typeAndClick(page, "원두명 검색", "프시", "찾기", page.getByRole("button", { name: p.name }));
  await clickUntil(
    page.getByRole("button", { name: p.name }),
    page.getByPlaceholder("봉투에 적힌 노트를 하나씩"),
  );

  await addChip(page, "봉투에 적힌 노트를 하나씩", "홍차");
  await clickUntilDb(
    page.getByRole("button", { name: "1개 추가" }),
    async () => (await prisma.sellerNote.count({ where: { productId: p.id } })) === 2,
  );
});

test("판정이 붙은 노트는 어드민도 못 지운다", async ({ page }) => {
  const p = await seedProduct("오메가", [
    { raw: "자스민", nodeId: "flower" },
    { raw: "청사과", nodeId: "other_fruit" },
  ]);
  const exp = await prisma.experience.create({
    data: { userId: USER, productId: p.id },
    select: { id: true },
  });
  await prisma.noteHit.create({
    data: { experienceId: exp.id, sellerNoteId: p.sellerNotes[0].id, value: "STRONG" },
  });

  await page.goto("/admin/products");
  await typeAndClick(page, "원두명 검색", "오메가", "찾기", page.getByRole("button", { name: p.name }));
  await clickUntil(
    page.getByRole("button", { name: p.name }),
    page.getByRole("row").filter({ hasText: "자스민" }),
  );

  // 왜 안 되는지를 먼저 보여준다 — 눌러보고 실패하게 두지 않는다
  const row = page.getByRole("row").filter({ hasText: "자스민" });
  await expect(row.getByRole("button", { name: "지우기" })).toBeDisabled();
  expect(await prisma.sellerNote.count({ where: { productId: p.id } })).toBe(2);
});

test("향 계층이 제 색과 상속을 구별해 보여준다", async ({ page }) => {
  await page.goto("/admin/flavors");
  await expect(page.getByRole("heading", { name: "향 계층" })).toBeVisible();

  // 점은 노드마다 하나다. **노드를 특정하지 않으면 스펙이 통과만 한다** —
  // `과일` 아래 L2 여섯이 전부 같은 색을 물려받아 색 문자열로는 구별이 안 된다
  const dot = (id: string) => page.getByTestId(`dot-${id}`);
  const fill = (id: string) => dot(id).evaluate((el) => getComputedStyle(el).backgroundColor);

  // **hex 를 박지 않는다** — 어드민이 색을 고칠 수 있게 된 순간 시드 색은
  // 스펙이 통제하지 않는 데이터가 된다. 지키려는 것은 「제 색과 상속이 구별된다」다
  const colorOf = async (id: string) =>
    (await prisma.flavorNode.findUniqueOrThrow({ where: { id }, select: { color: true } })).color;
  const asRgb = (hex: string) =>
    `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

  // 제 색을 가진 축을 하나 잡는다 — 점이 그 색으로 채워진다
  const own = await colorOf("flower");
  await expect(dot("flower")).toHaveAttribute("title", own!);
  expect(await fill("flower")).toBe(asRgb(own!));

  // 색이 없는 축은 부모에서 물려받는다. **이것이 구별돼야** 「띠가 온통 한 색」의
  // 원인을 화면에서 찾을 수 있다 — 채우지 않고 테두리만 그린다
  expect(await colorOf("berry"), "berry 에 색이 생기면 이 스펙은 다른 노드를 골라야 한다").toBe(null);
  await expect(dot("berry")).toHaveAttribute("title", `${await colorOf("fruity")} (부모에서 물려받음)`);
  expect(await fill("berry")).toBe("rgba(0, 0, 0, 0)");
});

test("「고치기」로 축의 색을 덮어쓰고 비워서 상속으로 되돌린다", async ({ page }) => {
  const colorOfFruity = async () =>
    (await prisma.flavorNode.findUniqueOrThrow({ where: { id: "fruity" }, select: { color: true } })).color;
  // 원래 색으로 되돌려 놓는다 — 시드 노드라 cleanup 이 안 건드린다
  const before = await prisma.flavorNode.findUniqueOrThrow({
    where: { id: "citrus" },
    select: { color: true },
  });

  try {
    // 상속 상태에서 시작한다. 어드민이 citrus 에 색을 넣어 두면 「물려받는 중」 이 안 뜬다 —
    // 실제로 그렇게 떨어졌다 (2026-09-16)
    await prisma.flavorNode.update({ where: { id: "citrus" }, data: { color: null } });
    await page.goto("/admin/flavors");
    const card = page.getByTestId("node-citrus");
    // 모달은 포털이 아니라 이 카드 안에 렌더된다 — 카드 밖에서 `.last()` 를 잡으면
    // **다른 카드의 「고치기」 트리거**가 걸리고 모달 배경이 클릭을 가로막는다
    const open = card.getByRole("button", { name: "고치기", exact: true }).first();
    const submit = card.getByRole("button", { name: "고치기", exact: true }).last();
    await open.click();

    // 지금은 `과일` 색을 물려받는 중이다. 그 사실이 보여야 비울지 말지를 판단한다
    await expect(card.getByText(`${await colorOfFruity()} 물려받는 중`)).toBeVisible();

    // 색은 색표에서만 고른다 (2026-09-16). 누른 색이 「지금 색」 자리에 올라와야 저장한다
    await clickUntil(card.getByRole("button", { name: "Lemon", exact: true }), card.getByText("Lemon #f6d800"));
    await clickUntilDb(
      submit,
      async () =>
        (
          await prisma.flavorNode.findUniqueOrThrow({
            where: { id: "citrus" },
            select: { color: true },
          })
        ).color === "#f6d800",
    );

    // 점이 제 색으로 채워진다 — 더는 상속이 아니다
    await expect(page.getByTestId("dot-citrus")).toHaveAttribute("title", "#f6d800");

    // 비우면 상속으로 돌아간다. **되돌릴 수단이 없으면 잘못 넣은 색을 영영 못 뺀다**
    await open.click();
    await card.getByRole("button", { name: "비우기" }).click();
    await clickUntilDb(
      submit,
      async () =>
        (
          await prisma.flavorNode.findUniqueOrThrow({
            where: { id: "citrus" },
            select: { color: true },
          })
        ).color === null,
    );
    await expect(page.getByTestId("dot-citrus")).toHaveAttribute(
      "title",
      `${await colorOfFruity()} (부모에서 물려받음)`,
    );
  } finally {
    await prisma.flavorNode.update({ where: { id: "citrus" }, data: { color: before.color } });
  }
});

test("별칭에 제 색을 주면 띠가 축 색 대신 그것을 쓴다", async ({ page }) => {
  // 별칭은 시드 데이터라 cleanup 이 안 건드린다. 끝나고 되돌린다
  const alias = await prisma.noteAlias.findFirstOrThrow({
    where: { raw: "자스민" },
    select: { id: true, color: true, nodeId: true },
  });
  const p = await seedProduct("별칭색", [{ raw: "자스민", nodeId: alias.nodeId }]);

  try {
    await page.goto("/admin/flavors");
    await page.getByTestId(`node-${alias.nodeId}`).getByRole("button", { name: /^자스민/ }).click();

    // 플레이스홀더는 물려받는 색을 그대로 찍으므로 DB 를 보고 만든다
    const node = await prisma.flavorNode.findUniqueOrThrow({
      where: { id: alias.nodeId },
      select: { color: true, parent: { select: { color: true } } },
    });
    const inherited = node.color ?? node.parent?.color;
    await expect(page.getByText(inherited ? `${inherited} 물려받는 중` : "색 없음")).toBeVisible();
    await clickUntil(
      page.getByRole("button", { name: "Raspberry", exact: true }),
      page.getByText("Raspberry #e32e86"),
    );
    await clickUntilDb(
      page.getByRole("button", { name: "색 바꾸기" }),
      async () =>
        (
          await prisma.noteAlias.findUniqueOrThrow({
            where: { id: alias.id },
            select: { color: true },
          })
        ).color === "#e32e86",
    );

    // **띠가 실제로 그 색을 쓴다.** 별칭과 판매자 노트 사이에 FK 가 없어서
    // 이 맞물림은 화면까지 와야 확인된다
    await page.goto(`/products/${p.id}`);
    const band = page.getByTestId("note-gradient");
    await expect(band).toBeVisible();
    expect(await band.getAttribute("style")).toContain("#e32e86");
  } finally {
    await prisma.noteAlias.update({ where: { id: alias.id }, data: { color: alias.color } });
  }
});

test("같은 향의 한영 표기를 합치면 칩이 하나가 되고 영문 노트도 그 색을 쓴다", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const ko = `합치기한글 ${TAG}`;
  const en = `Mergeeng ${TAG}`;
  const [koRow, enRow] = await Promise.all(
    [
      { raw: ko, color: "#abcdef" },
      { raw: en, color: null },
    ].map((a) =>
      prisma.noteAlias.create({
        data: { ...a, normalizedRaw: normalizeName(a.raw), nodeId: "citrus", scope: "PUBLIC" },
        select: { id: true },
      }),
    ),
  );
  const p = await seedProduct("한영합치기", [{ raw: en, nodeId: "citrus" }]);

  await page.goto("/admin/flavors");
  const node = page.getByTestId("node-citrus");
  await node.getByRole("button", { name: en }).click();
  // 영문을 한글 행에 흡수한다 — 모달의 합치기 목록에서 한글 표현을 고른다
  await clickUntilDb(
    page.getByRole("button", { name: ko, exact: true }).last(),
    async () => !(await prisma.noteAlias.findUnique({ where: { id: enRow.id } })),
  );
  expect(
    (await prisma.noteAlias.findUniqueOrThrow({ where: { id: koRow.id }, select: { rawEn: true } }))
      .rawEn,
  ).toBe(en);

  // 칩이 하나로 줄고 두 표기를 함께 보인다
  await page.goto("/admin/flavors");
  await expect(node.getByRole("button", { name: `${ko} · ${en}` })).toBeVisible();
  await expect(node.getByRole("button", { name: en, exact: true })).toHaveCount(0);

  // **판매자 노트는 지운 영문 표기를 그대로 쓴다.** 띠가 합쳐진 행의 색을 쓰는지는 화면까지 와야 보인다
  await page.goto(`/products/${p.id}`);
  const band = page.getByTestId("note-gradient");
  await expect(band).toBeVisible();
  expect(await band.getAttribute("style")).toContain("#abcdef");
});
