-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" INTEGER;
