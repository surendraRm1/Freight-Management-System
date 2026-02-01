-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('TRANSPORTER_PORTAL', 'TRANSPORTER_APP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_TRANSPORTER', 'CONFIRMED', 'DECLINED', 'EXPIRED');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "channel" TEXT DEFAULT 'SYSTEM',
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "quote_responses" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentSource" "ConsentSource",
ADD COLUMN     "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "bookingStatus" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED';

-- CreateTable
CREATE TABLE "consent_logs" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER,
    "quoteResponseId" INTEGER NOT NULL,
    "statusBefore" "ConsentStatus" NOT NULL,
    "statusAfter" "ConsentStatus" NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_quoteResponseId_fkey" FOREIGN KEY ("quoteResponseId") REFERENCES "quote_responses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
