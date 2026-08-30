-- DropIndex
DROP INDEX "LookupValue_aliases_idx";

-- DropIndex
DROP INDEX "LookupValue_nameKo_trgm_idx";

-- DropIndex
DROP INDEX "NoteAlias_raw_trgm_idx";

-- DropIndex
DROP INDEX "Product_attributes_idx";

-- DropIndex
DROP INDEX "Product_name_trgm_idx";

-- DropIndex
DROP INDEX "Product_normalizedName_trgm_idx";

-- DropIndex
DROP INDEX "SellerNote_raw_trgm_idx";

-- DropIndex
DROP INDEX "Vendor_aliases_idx";

-- DropIndex
DROP INDEX "Vendor_name_trgm_idx";

-- DropIndex
DROP INDEX "Vendor_normalizedName_trgm_idx";

-- AlterTable
ALTER TABLE "LookupValue" ADD COLUMN     "sortWeight" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "LookupValue_kind_sortWeight_idx" ON "LookupValue"("kind", "sortWeight");
