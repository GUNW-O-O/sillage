import { createHash } from "node:crypto";

import { normalizeName } from "./normalize";

/// Product 동일성 키의 절반이다 (설계 4-3).
/// 파생값이므로 **언제든 재계산 가능해야 한다** — 어드민이 미매핑 raw 를 붙이거나
/// 지우면 여기서 다시 계산되고, 그 결과 다른 Product 과 키가 같아질 수 있다 (7-4).
export type NoteForHash = {
  raw: string;
  nodeId: string | null;
};

/// 매핑 실패 항목이 집합에 참여하는 형태.
/// 빼면 노트 절반이 미매핑인 서로 다른 Product 이 같은 키로 충돌한다 (설계 4-3).
function tokenOf(note: NoteForHash): string {
  return note.nodeId ?? `unmapped:${normalizeName(note.raw)}`;
}

/// 집합 해시다 — 순서와 중복이 결과를 바꾸지 않는다.
/// "패션후르츠"와 "패션프룻"은 같은 nodeId 로 접히므로 같은 해시가 된다.
export function computeNoteSetHash(notes: readonly NoteForHash[]): string {
  const tokens = Array.from(new Set(notes.map(tokenOf))).sort();
  return createHash("sha256").update(tokens.join(" ")).digest("hex").slice(0, 32);
}
