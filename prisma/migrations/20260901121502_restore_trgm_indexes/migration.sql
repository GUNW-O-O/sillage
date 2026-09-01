-- CreateIndex
CREATE INDEX "NoteAlias_normalizedRaw_idx" ON "NoteAlias" USING GIN ("normalizedRaw" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Product_normalizedName_idx" ON "Product" USING GIN ("normalizedName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Vendor_normalizedName_idx" ON "Vendor" USING GIN ("normalizedName" gin_trgm_ops);
