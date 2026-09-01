/// 상세 입력의 순차 노출. 로스터리마다 공개 수준이 천차만별이라 상세를 한 번에 다 펼치면
/// 빈 칸이 대부분인 긴 폼이 된다 — 채우면 다음 칸이 뜨고, 모르면 건너뛴다 (설계 4-3).
///
/// **이 값은 상태가 아니다.** 채워진 칸에서 그때그때 나온다. effect 안에서 한 칸씩 밀어
/// 올리면 이미 세 칸이 채워져 있을 때 렌더가 세 번 연쇄한다.
/// 상태로 남는 것은 `건너뛰기` 로 사람이 올린 하한뿐이다.

/// `filled` 는 현재 구성에 해당하는 칸들이 채워졌는지. `floor` 는 건너뛰기가 올린 하한.
/// 하한에서 시작해 **직전 칸이 채워져 있는 동안** 이어서 민다.
///
/// 하한이 필요한 이유: 건너뛴 칸은 비어 있어서, 하한 없이 채워진 칸만 세면 노출이
/// 그 빈 칸에서 다시 멈춘다 — 건너뛴 다음 칸을 영영 못 본다.
export function revealCount(filled: boolean[], floor: number): number {
  const total = filled.length;
  if (total === 0) return 0;

  // 구성이 single ↔ blend 로 바뀌면 칸 수가 줄 수 있다. 하한도 같이 잘린다
  let r = Math.min(Math.max(floor, 1), total);
  while (r < total && filled[r - 1]) r += 1;
  return r;
}
