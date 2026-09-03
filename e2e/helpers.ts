import { expect, type Locator, type Page } from "@playwright/test";
import { BrewMethod, Category, Phase, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { computeNoteSetHash } from "../src/lib/note-set-hash";
import { normalizeName } from "../src/lib/normalize";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

/// 테스트가 만든 것은 전부 이 꼬리표를 단다. 개발 중 쌓인 실제 데이터를 안 건드린다.
///
/// **앞이 아니라 뒤에 붙인다.** `normalizeName` 이 기호를 걷어내므로 앞에 붙이면
/// "[E2E] 이오타" 가 "e2e이오타" 가 되어 "이오타" 로 앞 일치 검색이 안 된다 —
/// 검색 흐름을 테스트하면서 검색이 안 되는 이름을 쓰게 된다
export const TAG = "[E2E]";
export const USER = "seed-admin";

/// 하이드레이션 전에 누르면 onClick 이 아직 안 붙어 클릭이 그냥 삼켜진다.
/// Playwright 는 요소가 보이면 바로 누르므로 **눌린 결과가 나올 때까지 다시 누른다.**
/// networkidle 은 못 쓴다 — dev 서버는 HMR 웹소켓이 계속 열려 있어 idle 이 안 온다.
///
/// 기다릴 조건은 **로케이터로 받는다.** 문자열로 받으면 우연히 다른 자리에 있는 같은
/// 문구에 걸려 조용히 통과한다 — 목록의 `느낀 노트 / 판매자 노트` 가 실제로 그랬다.
export async function actUntil(act: () => Promise<unknown>, appears: Locator) {
  let acted = false;
  await expect(async () => {
    // **두 번째 시도부터는 다시 누르기 전에 조건을 먼저 본다.** 첫 클릭이 먹었는데
    // 결과가 1초 안에 안 나오는 경우(dev 서버가 다음 라우트를 처음 컴파일할 때가 그렇다)
    // 누를 것은 이미 화면에서 사라져 있다. 그 자리에서 다시 누르면 Playwright 는
    // 기본 actionTimeout 이 0 이라 **영영 기다리고**, 조건을 다시 볼 기회가 오지 않는다 —
    // 결과는 이미 화면에 떠 있는데 20초를 채우고 실패한다 (register.spec.ts 가 그랬다).
    //
    // 첫 시도는 그대로 누른다. 조건이 처음부터 떠 있는 경우(항상 있는 요소를 기다리는
    // 테스트)에 아무것도 안 누르고 통과해버리는 것을 막는다
    if (acted && (await appears.first().isVisible())) return;
    acted = true;
    await act();
    await expect(appears.first()).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

/// 누를 것도 로케이터로 받는다. 이름 부분 일치는 **엉뚱한 것을 집는다** —
/// 시드 원두 이름이 목록 버튼의 접근성 이름에 들어가 있어 시트 뒤의 행을 눌렀다
export async function clickUntil(target: Locator, appears: Locator) {
  // **시간 제한을 준다.** 사라진 요소를 무기한 기다리면 재시도 자체가 멈춘다 (actUntil 참고)
  await actUntil(() => target.first().click({ timeout: 2000 }), appears);
}

/// aria-label 로 다는 아이콘 버튼. 정확히 일치시켜야 목록 행에 안 걸린다
export const icon = (page: Page, label: string) =>
  page.getByRole("button", { name: label, exact: true });

/// 입력하고 누른다. **매 시도마다 다시 채운다** — 컨트롤드 입력이라 하이드레이션 전의
/// `fill` 은 DOM 값만 바꾸고 React 상태에는 안 들어간다. 그러면 값에 따라 활성화되는
/// 버튼이 계속 비활성으로 남아 클릭이 영영 안 먹는다
export async function typeAndClick(
  page: Page,
  placeholder: string,
  text: string,
  button: string,
  appears: Locator,
) {
  await actUntil(async () => {
    await typeInto(page, placeholder, text);
    await page.getByRole("button", { name: button, exact: true }).click({ timeout: 2000 });
  }, appears);
}

/// `fill` 이 아니라 실제 타이핑이다. `fill` 은 값을 한 번에 밀어넣는데 그 입력이
/// React 상태에 안 들어가는 경우가 있다 — 어드민 검색창이 그랬다. 값은 프시로 보이는데
/// 상태는 빈 문자열이라 길이로 활성화되는 `찾기` 버튼이 영영 비활성으로 남았다
export async function typeInto(page: Page, placeholder: string, text: string) {
  const input = page.getByPlaceholder(placeholder);
  await input.fill("", { timeout: 2000 });
  await input.pressSequentially(text, { timeout: 2000 });
}

/// 결과가 화면이 아니라 DB 에 나타나는 조작에 쓴다.
///
/// 화면 문구로 기다리면 두 가지로 어긋난다 — **항상 떠 있는 요소**를 기다리면 클릭이
/// 안 먹었는데 통과하고(노트 입력칸이 그랬다), 갱신이 늦으면 실패로 읽힌다.
/// 무엇이 일어났는지는 DB 가 가장 정확하다
export async function clickUntilDb(target: Locator, done: () => Promise<boolean>) {
  await expect(async () => {
    if (await done()) return;
    await target.first().click({ timeout: 2000 });
    await new Promise((r) => setTimeout(r, 400));
    expect(await done(), "DB 가 아직 안 바뀌었다").toBe(true);
  }).toPass({ timeout: 20_000 });
}

/// 시트 안이라는 것을 무엇으로 아나 — 목록에는 없는 닫기 버튼이다.
/// 문구로 판단하면 안 된다: 목록에도 `느낀 노트 / 판매자 노트` 가 있어
/// 시트가 안 열렸는데 열린 줄 알고 통과했다
export const sheetOpen = (page: Page) => icon(page, "닫기");

/// 목록에서 기록 시트를 연다
export async function openSheet(page: Page, productName: string) {
  await clickUntil(page.getByRole("button", { name: productName }), sheetOpen(page));
}

/// 노트 칩 입력. 타이핑도 하이드레이션 뒤에야 먹으므로 칩이 뜰 때까지 다시 넣는다
export async function addChip(page: Page, placeholder: string, text: string) {
  // getByRole 의 name 은 기본이 부분 일치라 정규식이 필요 없다
  await actUntil(async () => {
    await typeInto(page, placeholder, text);
    await page.getByPlaceholder(placeholder).press("Enter", { timeout: 2000 });
  }, page.getByRole("button", { name: text }));
}

export type SeedNote = { raw: string; nodeId: string | null };

/// 테스트용 원두 하나. 로스터리는 시드에 있는 것을 쓴다 —
/// 로스터리까지 만들면 승인 대기 목록이 테스트 사이에 샌다
export async function seedProduct(name: string, notes: SeedNote[]) {
  const vendor = await prisma.vendor.findFirstOrThrow({ select: { id: true, name: true } });
  const full = `${name} ${TAG}`;
  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      category: Category.COFFEE,
      name: full,
      normalizedName: normalizeName(full),
      noteSetHash: computeNoteSetHash(notes),
      attributes: {},
      sellerNotes: { create: notes.map((n, i) => ({ ...n, position: i })) },
    },
    select: {
      id: true,
      name: true,
      sellerNotes: { select: { id: true, raw: true }, orderBy: { position: "asc" } },
    },
  });
  return { ...product, vendorName: vendor.name };
}

/// 이미 기록이 있는 상태를 만든다. 기록 조회 · 수정 · 삭제 흐름이 필요로 한다
export async function seedRecord(productId: string, hits: { sellerNoteId: string; value: "MISS" | "UNSURE" | "WEAK" | "STRONG" }[]) {
  const exp = await prisma.experience.create({
    data: { userId: USER, productId, method: BrewMethod.HAND_DRIP, phase: Phase.OVERALL },
    select: { id: true },
  });
  if (hits.length > 0) {
    await prisma.noteHit.createMany({
      data: hits.map((h) => ({ experienceId: exp.id, ...h })),
    });
  }
  return exp;
}

/// 기록이 붙어 있으면 Product 삭제가 FK 로 막히므로 기록부터 지운다
export async function cleanup() {
  await prisma.experience.deleteMany({ where: { product: { name: { contains: TAG } } } });
  await prisma.sellerNoteProposal.deleteMany({
    where: { product: { name: { contains: TAG } } },
  });
  await prisma.product.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.vendor.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.noteAlias.deleteMany({ where: { raw: { contains: TAG } } });
}
