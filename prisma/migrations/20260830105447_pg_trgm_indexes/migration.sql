-- pg_trgm 확장과 GIN 인덱스. Prisma 스키마로 표현할 수 없어 raw SQL 이다 (설계 8장).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 근접 후보 검색. 표기 흔들림을 흡수하는 검색의 전제다
CREATE INDEX "Vendor_name_trgm_idx"           ON "Vendor"      USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Vendor_normalizedName_trgm_idx" ON "Vendor"      USING GIN ("normalizedName" gin_trgm_ops);
CREATE INDEX "Product_name_trgm_idx"          ON "Product"     USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_normalizedName_trgm_idx" ON "Product"    USING GIN ("normalizedName" gin_trgm_ops);

-- ── 노트 자동완성. 이미 등록된 raw 표현으로 제안한다 (설계 7-1)
CREATE INDEX "NoteAlias_raw_trgm_idx"  ON "NoteAlias"  USING GIN ("raw" gin_trgm_ops);
CREATE INDEX "SellerNote_raw_trgm_idx" ON "SellerNote" USING GIN ("raw" gin_trgm_ops);

-- ── lookup 검색
CREATE INDEX "LookupValue_nameKo_trgm_idx" ON "LookupValue" USING GIN ("nameKo" gin_trgm_ops);

-- ── aliases 배열 조회. 표기 흔들림 흡수 경로 (설계 4-2 · 4-8)
CREATE INDEX "Vendor_aliases_idx"      ON "Vendor"      USING GIN ("aliases");
CREATE INDEX "LookupValue_aliases_idx" ON "LookupValue" USING GIN ("aliases");

-- ── 축 집계용 JSONB. attributes 안의 lookup id 는 FK 를 걸 수 없어 인덱스로 받는다 (설계 4-3)
CREATE INDEX "Product_attributes_idx" ON "Product" USING GIN ("attributes" jsonb_path_ops);

-- ── 미매핑 큐. 어드민의 주 작업 화면이라 부분 인덱스로 받는다 (설계 7-4)
CREATE INDEX "SellerNote_unmapped_idx" ON "SellerNote" ("productId") WHERE "nodeId" IS NULL;
