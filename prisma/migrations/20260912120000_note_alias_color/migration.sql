-- 표현마다 색을 덮어쓸 수 있게 한다 (설계 2026-09-08 §6).
-- **기본은 상속이라 nullable 이다** — 값이 없으면 앉은 축의 색을 그대로 쓴다.
-- 소급이 없다: 기존 행은 전부 NULL 이라 지금 화면과 똑같이 그려진다.
ALTER TABLE "NoteAlias" ADD COLUMN     "color" TEXT;
