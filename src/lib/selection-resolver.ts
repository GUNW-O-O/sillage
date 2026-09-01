/// 이미 고른 항목의 **이름을 id 로 채워 넣는** 절차. `LookupPicker` 가 쓴다.
///
/// 컴포넌트 밖으로 뺀 이유: 이 자리의 버그는 순수 로직이 아니라 **effect 수명주기**에서
/// 났다. StrictMode 는 개발에서 effect 를 `실행 → 정리 → 재실행` 으로 두 번 돌리는데,
/// 1회차가 "물어봤음" 표시를 남기고 요청을 띄운 뒤 정리 단계가 그 응답을 취소해 버리면,
/// 2회차는 표시 때문에 아무것도 안 해서 **이름이 영영 안 채워진다.**
/// 그 순서를 테스트로 재현하려고 함수로 뺀다.

export type Resolver = (selected: string[]) => void;

/// `fetchByIds` 는 아직 이름을 모르는 id 만 받는다. `onResolved` 는 받아온 것을 넘긴다.
///
/// **취소 가드를 두지 않는다.** 늦게 온 응답이 해를 못 끼치는 구조라서다 — 받는 쪽이
/// id 로 합치므로 중복도 뒤집힘도 없다. 여기서 취소를 하면 위의 StrictMode 순서에서
/// 유일한 요청이 버려진다.
///
/// 한 번 물어본 id 는 기억한다. 지워진 항목을 가리키는 id 는 응답이 비어 영영 안
/// 채워지는데, "채워졌는가" 로 판단하면 요청이 무한히 돈다.
export function createSelectionResolver<T extends { id: string }>(
  fetchByIds: (ids: string[]) => Promise<T[]>,
  onResolved: (rows: T[]) => void,
): Resolver {
  const asked = new Set<string>();

  return (selected: string[]) => {
    const missing = selected.filter((id) => !asked.has(id));
    if (missing.length === 0) return;
    for (const id of missing) asked.add(id);

    void fetchByIds(missing).then((rows) => {
      if (rows.length === 0) return;
      onResolved(rows);
    });
  };
}
