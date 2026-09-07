-- AlterTable
ALTER TABLE "InviteCode" ADD COLUMN     "usedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InviteAttempt" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InviteAttempt_ip_at_idx" ON "InviteAttempt"("ip", "at");

