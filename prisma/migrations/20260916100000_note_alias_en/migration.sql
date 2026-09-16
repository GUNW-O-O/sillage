-- 같은 향의 영문 표기를 한 행에 담는다 (mergeAlias). 병합 전에는 NULL 이다.
ALTER TABLE "NoteAlias" ADD COLUMN     "normalizedEn" TEXT,
ADD COLUMN     "rawEn" TEXT;

-- 자동완성이 normalizedRaw 와 함께 이 칸도 contains 로 훑는다
CREATE INDEX "NoteAlias_normalizedEn_idx" ON "NoteAlias" USING GIN ("normalizedEn" gin_trgm_ops);

-- public 표기는 영문 칸에서도 하나여야 한다. NoteAlias_public_normalizedRaw_key 와 같은 이유로
-- 부분 유니크 인덱스다. **두 칸 사이의 충돌(한 행의 normalizedEn = 다른 행의 normalizedRaw)은
-- 인덱스로 못 막는다** — mergeAlias 가 소스를 지우고 attachNote 가 두 칸을 모두 보는 것으로 막는다
CREATE UNIQUE INDEX "NoteAlias_public_normalizedEn_key"
  ON "NoteAlias" ("normalizedEn")
  WHERE "scope" = 'PUBLIC';
