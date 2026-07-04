-- AlterTable
ALTER TABLE "User" ADD COLUMN "authId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_authId_key" ON "User"("authId");

-- CreateTable
CREATE TABLE "PendingLink" (
    "authId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingLink_pkey" PRIMARY KEY ("authId")
);
