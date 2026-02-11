-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "QuoteResponse" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;
