-- AlterTable
ALTER TABLE "LookupValue" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
