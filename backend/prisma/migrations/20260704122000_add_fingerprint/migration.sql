-- AlterTable
ALTER TABLE "User" ADD COLUMN "blunderFingerprint" JSONB,
ADD COLUMN "fingerprintComputedAt" TIMESTAMP(3);
