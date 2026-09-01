import { describe, expect, it, vi } from "vitest";

import { createSelectionResolver } from "./selection-resolver";

type Row = { id: string; nameKo: string };

const rowsFor = (ids: string[]): Row[] => ids.map((id) => ({ id, nameKo: `이름:${id}` }));

describe("createSelectionResolver", () => {
  it("모르는 id 의 이름을 한 번 받아온다", async () => {
    const fetchByIds = vi.fn(async (ids: string[]) => rowsFor(ids));
    const onResolved = vi.fn();
    const resolve = createSelectionResolver(fetchByIds, onResolved);

    resolve(["a", "b"]);
    await vi.waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));

    expect(fetchByIds).toHaveBeenCalledWith(["a", "b"]);
    expect(onResolved.mock.calls[0][0]).toEqual(rowsFor(["a", "b"]));
  });

  // 실제로 났던 버그. StrictMode 는 effect 를 `실행 → 정리 → 재실행` 으로 돌린다.
  // 1회차가 물어봤음 표시를 남기고 요청을 띄운 뒤 정리 단계가 응답을 취소하면,
  // 2회차는 표시 때문에 요청을 안 보내 이름이 영영 안 채워진다 —
  // 화면에서는 이미 고른 나라 · 가공 · 품종이 통째로 사라진 것처럼 보인다.
  it("두 번 실행돼도(StrictMode) 응답이 버려지지 않는다", async () => {
    const fetchByIds = vi.fn(async (ids: string[]) => rowsFor(ids));
    const onResolved = vi.fn();
    const resolve = createSelectionResolver(fetchByIds, onResolved);

    resolve(["a"]); // 1회차
    resolve(["a"]); // 정리 뒤 2회차 — 이미 물어봤으므로 요청은 안 나간다
    await vi.waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));

    expect(fetchByIds).toHaveBeenCalledTimes(1);
    expect(onResolved.mock.calls[0][0]).toEqual(rowsFor(["a"]));
  });

  it("매 렌더 불려도 같은 id 를 다시 안 물어본다", async () => {
    const fetchByIds = vi.fn(async (ids: string[]) => rowsFor(ids));
    const resolve = createSelectionResolver(fetchByIds, () => {});

    for (let i = 0; i < 5; i += 1) resolve(["a"]);
    await vi.waitFor(() => expect(fetchByIds).toHaveBeenCalledTimes(1));
  });

  it("새로 고른 id 만 추가로 물어본다", async () => {
    const fetchByIds = vi.fn(async (ids: string[]) => rowsFor(ids));
    const resolve = createSelectionResolver(fetchByIds, () => {});

    resolve(["a"]);
    await vi.waitFor(() => expect(fetchByIds).toHaveBeenCalledTimes(1));
    resolve(["a", "b"]);
    await vi.waitFor(() => expect(fetchByIds).toHaveBeenCalledTimes(2));

    expect(fetchByIds.mock.calls[1][0]).toEqual(["b"]);
  });

  // 지워진 항목을 가리키는 id 는 응답이 빈다. "채워졌는가" 로 판단하면 요청이 무한히 돈다
  it("응답이 비어도 같은 id 를 다시 안 물어본다", async () => {
    const fetchByIds = vi.fn(async () => [] as Row[]);
    const onResolved = vi.fn();
    const resolve = createSelectionResolver(fetchByIds, onResolved);

    resolve(["없는id"]);
    await vi.waitFor(() => expect(fetchByIds).toHaveBeenCalledTimes(1));
    resolve(["없는id"]);
    resolve(["없는id"]);

    expect(fetchByIds).toHaveBeenCalledTimes(1);
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("아무것도 안 골랐으면 요청하지 않는다", () => {
    const fetchByIds = vi.fn(async (ids: string[]) => rowsFor(ids));
    createSelectionResolver(fetchByIds, () => {})([]);
    expect(fetchByIds).not.toHaveBeenCalled();
  });
});
