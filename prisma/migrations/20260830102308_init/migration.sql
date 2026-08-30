-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AliasScope" AS ENUM ('PERSONAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "LookupKind" AS ENUM ('COUNTRY', 'VARIETY', 'PROCESS');

-- CreateEnum
CREATE TYPE "LookupStatus" AS ENUM ('PENDING', 'APPROVED');

-- CreateEnum
CREATE TYPE "VendorRole" AS ENUM ('ROASTER', 'IMPORTER', 'CAFE');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('COFFEE', 'PERFUME', 'WINE', 'WHISKY', 'DIFFUSER');

-- CreateEnum
CREATE TYPE "BrewMethod" AS ENUM ('HAND_DRIP', 'ESPRESSO', 'COLD_BREW');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('OVERALL', 'NOSE', 'PALATE', 'FINISH', 'TOP', 'MIDDLE', 'BASE');

-- CreateEnum
CREATE TYPE "NoteHitValue" AS ENUM ('MISS', 'UNSURE', 'WEAK', 'STRONG');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "provider" TEXT,
    "providerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "usedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlavorNode" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "labelKo" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,

    CONSTRAINT "FlavorNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteAlias" (
    "id" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "normalizedRaw" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "scope" "AliasScope" NOT NULL DEFAULT 'PERSONAL',
    "createdById" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LookupValue" (
    "id" TEXT NOT NULL,
    "kind" "LookupKind" NOT NULL,
    "code" TEXT,
    "nameKo" TEXT NOT NULL,
    "nameEn" TEXT,
    "normalizedName" TEXT NOT NULL,
    "status" "LookupStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LookupValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roles" "VendorRole"[] DEFAULT ARRAY[]::"VendorRole"[],
    "website" TEXT,
    "region" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "category" "Category" NOT NULL DEFAULT 'COFFEE',
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "noteSetHash" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerNote" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "nodeId" TEXT,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "method" "BrewMethod" NOT NULL DEFAULT 'HAND_DRIP',
    "phase" "Phase" NOT NULL DEFAULT 'OVERALL',
    "place" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteHit" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "sellerNoteId" TEXT NOT NULL,
    "value" "NoteHitValue" NOT NULL DEFAULT 'MISS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraNote" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_provider_providerUserId_key" ON "User"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_codeHash_key" ON "InviteCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_usedByUserId_key" ON "InviteCode"("usedByUserId");

-- CreateIndex
CREATE INDEX "InviteCode_expiresAt_idx" ON "InviteCode"("expiresAt");

-- CreateIndex
CREATE INDEX "FlavorNode_level_idx" ON "FlavorNode"("level");

-- CreateIndex
CREATE INDEX "FlavorNode_parentId_idx" ON "FlavorNode"("parentId");

-- CreateIndex
CREATE INDEX "NoteAlias_nodeId_idx" ON "NoteAlias"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteAlias_normalizedRaw_scope_createdById_key" ON "NoteAlias"("normalizedRaw", "scope", "createdById");

-- CreateIndex
CREATE INDEX "LookupValue_kind_status_idx" ON "LookupValue"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LookupValue_kind_normalizedName_key" ON "LookupValue"("kind", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_normalizedName_key" ON "Vendor"("normalizedName");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE INDEX "Product_vendorId_idx" ON "Product"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_vendorId_category_normalizedName_noteSetHash_key" ON "Product"("vendorId", "category", "normalizedName", "noteSetHash");

-- CreateIndex
CREATE INDEX "SellerNote_nodeId_idx" ON "SellerNote"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerNote_productId_position_key" ON "SellerNote"("productId", "position");

-- CreateIndex
CREATE INDEX "Experience_productId_idx" ON "Experience"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Experience_userId_productId_method_phase_key" ON "Experience"("userId", "productId", "method", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "NoteHit_experienceId_sellerNoteId_key" ON "NoteHit"("experienceId", "sellerNoteId");

-- CreateIndex
CREATE INDEX "ExtraNote_experienceId_idx" ON "ExtraNote"("experienceId");

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlavorNode" ADD CONSTRAINT "FlavorNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FlavorNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAlias" ADD CONSTRAINT "NoteAlias_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "FlavorNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAlias" ADD CONSTRAINT "NoteAlias_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LookupValue" ADD CONSTRAINT "LookupValue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerNote" ADD CONSTRAINT "SellerNote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerNote" ADD CONSTRAINT "SellerNote_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "FlavorNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteHit" ADD CONSTRAINT "NoteHit_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteHit" ADD CONSTRAINT "NoteHit_sellerNoteId_fkey" FOREIGN KEY ("sellerNoteId") REFERENCES "SellerNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraNote" ADD CONSTRAINT "ExtraNote_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraNote" ADD CONSTRAINT "ExtraNote_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "FlavorNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
