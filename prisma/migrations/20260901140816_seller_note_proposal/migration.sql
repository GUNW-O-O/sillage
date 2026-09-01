-- CreateTable
CREATE TABLE "SellerNoteProposal" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "normalizedRaw" TEXT NOT NULL,
    "nodeId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerNoteProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerNoteProposal_productId_idx" ON "SellerNoteProposal"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerNoteProposal_productId_normalizedRaw_createdById_key" ON "SellerNoteProposal"("productId", "normalizedRaw", "createdById");

-- AddForeignKey
ALTER TABLE "SellerNoteProposal" ADD CONSTRAINT "SellerNoteProposal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerNoteProposal" ADD CONSTRAINT "SellerNoteProposal_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "FlavorNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerNoteProposal" ADD CONSTRAINT "SellerNoteProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
