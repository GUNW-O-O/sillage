-- DropIndex
DROP INDEX "InviteCode_codeHash_key";

-- AlterTable
ALTER TABLE "InviteCode" DROP COLUMN "codeHash",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "label" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");
