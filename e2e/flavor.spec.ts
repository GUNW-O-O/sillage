import { expect, test } from "@playwright/test";

import {
  actUntil,
  cleanup,
  clickUntil,
  icon,
  openSheet,
  prisma,
  seedProduct,
  seedRecord,
  TAG,
  typeInto,
} from "./helpers";

// 향 계층이 화면에서 성립하는가 (설계 2026-09-08 §9).
//
// **여기서만 보이는 것들이다.** 자동완성 목록은 클라이언트 상태고, 그라데이션은 노트 색을
// 이어 붙인 결과라 DB 검사로는 둘 다 안 보인다. `scripts/check-flavor.ts` 는 그 아래층
// (해시 · 상속 · 질의)을 본다.

const NOTE = "봉투에 적힌 노트를 하나씩";

/// 노드의 지금 색을 DB 에서 읽는다. **스펙에 hex 를 박으면 안 된다** —
/// 어드민이 색을 고칠 수 있게 된 순간 그 값은 스펙이 통제하지 않는 데이터가 된다
/// (실제로 시드 색을 박아 뒀다가 색을 바꾸자 셋이 떨어졌다).
const colorOf = async (id: string) =>
  (await prisma.flavorNode.findUniqueOrThrow({ where: { id }, select: { color: true } })).color!;

/// 브라우저는 클라이언트에서 붙인 인라인 style 을 rgb 로 정규화한다.
/// 서버 렌더는 hex 가 그대로 남는다 — 같은 색인데 표기가 다르다
const asRgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;


test.beforeEach(() => cleanup());
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const openForm = async (page: import("@playwright/test").Page) => {
  const vendor = await prisma.vendor.findFirstOrThrow({ select: { id: true } });
  await page.goto(`/products/new?vendorId=${vendor.id}`);
  await expect(page.getByRole("heading", { name: "원두 등록" })).toBeVisible();
};

test("자동완성이 계층 경로를 보여준다", async ({ page }) => {
  await openForm(page);

  // 큰 갈래와 세부가 한 목록에 섞이므로 어디에 붙는지가 보여야 한다
  await actUntil(
    () => typeInto(page, NOTE, "플로럴"),
    page.getByText("꽃 · 차 > 화이트 플로럴"),
  );
});

test("총칭을 큰 갈래에 직접 붙인다", async ({ page }) => {
  await openForm(page);

  // `단맛` 은 어떤 향의 이름이 아니라 카테고리 이름 자체다. 흑설탕도 카라멜도 아닌 것을
  // 하위에 앉히면 없는 정보를 내려보내는 것이라 L1 에 직접 붙는다 (설계 §4)
  await actUntil(async () => {
    await typeInto(page, NOTE, "단맛");
    await page.getByRole("button", { name: "단맛", exact: true }).click({ timeout: 2000 });
  }, page.getByRole("button", { name: "단맛 ×" }));

  await page.getByPlaceholder("봉투에 적힌 그대로").fill(`총칭 ${TAG}`);
  await actUntil(
    () => page.getByRole("button", { name: "등록하고 기록하기" }).click({ timeout: 2000 }),
    page.getByRole("link", { name: "기록 입력", exact: true }),
  );

  const created = await prisma.product.findFirstOrThrow({
    where: { name: `총칭 ${TAG}` },
    select: { sellerNotes: { select: { raw: true, nodeId: true } } },
  });
  expect(created.sellerNotes).toEqual([{ raw: "단맛", nodeId: "sweet" }]);
});

test("원두 상세가 노트 색을 이어 그라데이션을 그린다", async ({ page }) => {
  const p = await seedProduct("그라데이션", [
    // 색이 노드에 직접 있는 축과, 부모에서 물려받는 축을 섞는다
    { raw: "자스민", nodeId: "flower" },
    { raw: "블루베리", nodeId: "berry" },
  ]);
  await page.goto(`/products/${p.id}`);

  const band = page.locator('[aria-hidden][style*="linear-gradient"]');
  await expect(band).toBeVisible();
  const style = await band.getAttribute("style");
  // 화이트 플로럴의 제 색과, berry 가 부모 `과일` 에서 물려받은 색이 순서대로 들어간다
  const [white, fruity] = [await colorOf("flower"), await colorOf("fruity")];
  expect(style).toContain(white);
  expect(style).toContain(fruity);
  expect(style!.indexOf(white)).toBeLessThan(style!.indexOf(fruity));
});

test("붙은 축이 하나도 없으면 띠를 안 그린다", async ({ page }) => {
  const p = await seedProduct("색없음", [{ raw: "누룩", nodeId: null }]);
  await page.goto(`/products/${p.id}`);

  await expect(page.getByRole("heading", { name: p.name })).toBeVisible();
  // 없는 색을 회색으로 채우면 「회색인 향」처럼 보인다 — 아예 안 그린다 (설계 §6 미결 해소)
  await expect(page.locator('[aria-hidden][style*="linear-gradient"]')).toHaveCount(0);
});

test("띠가 원두 정보 박스의 상단 경계에 붙는다", async ({ page }) => {
  const p = await seedProduct(
    "박스띠",
    [{ raw: "자스민", nodeId: "flower" }],
    { kind: "single", roastLevel: "LIGHT" },
  );
  await page.goto(`/products/${p.id}`);

  // 띠는 제목 아래 떠 있는 막대가 아니라 카드의 일부다 — 박스 안에 있어야 한다
  const box = page.locator("section", { has: page.getByRole("heading", { name: "원두 정보" }) });
  await expect(box.getByTestId("note-gradient")).toBeVisible();
});

test("기록 시트의 원두 정보에도 같은 띠가 뜬다", async ({ page }) => {
  const p = await seedProduct(
    "시트띠",
    [
      { raw: "자스민", nodeId: "flower" },
      { raw: "블루베리", nodeId: "berry" },
    ],
    { kind: "single", roastLevel: "LIGHT" },
  );
  await seedRecord(p.id, [{ sellerNoteId: p.sellerNotes[0].id, value: "STRONG" }]);

  await page.goto("/");
  await openSheet(page, p.name);

  // 판정을 매기는 자리에서도 이 원두의 프로필이 보인다. 원두 상세와 같은 띠다
  const band = page.getByTestId("note-gradient");
  await expect(band).toBeVisible();
  const style = await band.getAttribute("style");
  expect(style).toContain(asRgb(await colorOf("flower")));
  expect(style).toContain(asRgb(await colorOf("fruity")));
});

test("색이 하나도 없으면 기록 시트도 띠를 안 그린다", async ({ page }) => {
  const p = await seedProduct("시트색없음", [{ raw: "누룩", nodeId: null }], {
    kind: "single",
    roastLevel: "LIGHT",
  });
  await seedRecord(p.id, []);

  await page.goto("/");
  await openSheet(page, p.name);

  await expect(page.getByText("누룩")).toBeVisible();
  await expect(page.getByTestId("note-gradient")).toHaveCount(0);
});

test("느낀 노트는 그 향의 색으로 칠하고 안 느낀 것은 무채색으로 둔다", async ({ page }) => {
  const p = await seedProduct(
    "판정색",
    [
      { raw: "자스민", nodeId: "flower" },
      { raw: "블루베리", nodeId: "berry" },
    ],
    { kind: "single", roastLevel: "LIGHT" },
  );
  await seedRecord(p.id, [{ sellerNoteId: p.sellerNotes[0].id, value: "STRONG" }]);

  await page.goto("/");
  await openSheet(page, p.name);

  // **시트의 판정 목록으로 범위를 좁힌다** — 시트 뒤에 기록 목록이 그대로 있어서
  // 노트 이름과 겹치는 원두가 하나라도 있으면 li 가 둘 잡힌다
  const chips = page.getByTestId("note-judgements");

  // 강함은 그 향의 원색이다 — 띠와 같은 색이라야 「이 향이 이 색」이 성립한다
  const strong = chips.getByRole("listitem").filter({ hasText: "자스민" });
  await expect(strong).toContainText("강함");
  expect(await strong.locator("div").first().evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe(asRgb(await colorOf("flower")));

  // **안 건드린 노트는 무채색이다.** 못 느낀 것에 색을 주면 띠와 어긋난다
  const miss = chips.getByRole("listitem").filter({ hasText: "블루베리" });
  await expect(miss).toContainText("못 느낌");
  // **「그 색이 아니다」로는 부족하다** — 색을 반쯤 섞어 칠해도 원색과는 다르니 통과한다.
  // 못 느낌은 배경이 아예 없다(테두리만 있는 칩)는 것이 지켜야 할 주장이다
  const bg = await miss
    .locator("div")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg, "못 느낌에 배경색이 칠해졌다").toBe("rgba(0, 0, 0, 0)");
});

test("판정을 순환해도 칩 크기가 안 변하고 콘솔이 조용하다", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  const p = await seedProduct(
    "순환",
    [{ raw: "자스민", nodeId: "flower" }],
    { kind: "single", roastLevel: "LIGHT" },
  );
  await seedRecord(p.id, []);

  await page.goto("/");
  await openSheet(page, p.name);
  await clickUntil(icon(page, "수정"), page.getByText("느낀 것만 눌러 주세요"));

  const chip = page.getByTestId("note-judgements").getByRole("button").first();
  const box = async () => {
    const b = await chip.boundingBox();
    return `${b!.width}x${b!.height}`;
  };

  // 못 느낌 → 모르겠음 → 약함 → 강함 → 못 느낌. **테두리가 있는 상태와 없는 상태가
  // 섞이면 1px 씩 흔들린다** — 누를 때마다 칩이 움찔거려 무엇을 눌렀는지 놓친다
  const sizes = new Set<string>();
  const labels: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    sizes.add(await box());
    labels.push((await chip.innerText()).split("\n").pop()!);
    await chip.click();
  }

  expect(labels).toEqual(["못 느낌", "모르겠음", "약함", "강함", "못 느낌"]);
  expect([...sizes], "판정이 바뀔 때 칩 크기가 달라진다").toHaveLength(1);
  expect(errors, "순환 중 콘솔 오류가 났다").toEqual([]);
});
