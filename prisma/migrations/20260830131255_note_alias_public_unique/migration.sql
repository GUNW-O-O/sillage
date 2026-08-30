-- public 별칭은 표현당 하나여야 한다.
-- @@unique([normalizedRaw, scope, createdById]) 는 public 에 대해 동작하지 않는다 —
-- public 은 createdById 가 NULL 이고 Postgres 에서 NULL 끼리는 충돌하지 않기 때문이다.
-- 같은 표현의 public 별칭이 무한히 쌓이는 것을 부분 유니크 인덱스로 막는다.
CREATE UNIQUE INDEX "NoteAlias_public_normalizedRaw_key"
  ON "NoteAlias" ("normalizedRaw")
  WHERE "scope" = 'PUBLIC';
