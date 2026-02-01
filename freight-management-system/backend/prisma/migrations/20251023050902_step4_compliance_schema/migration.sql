-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXEMPT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('GST_INVOICE', 'SELF_INVOICE_RCM', 'EWAY_BILL', 'DRIVER_KYC', 'VEHICLE_KYC');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "rcmLiability" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "tcsAmount" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "tdsAmount" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "vendor_profiles" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "legalName" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "tan" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'IN',
    "rcmEligible" BOOLEAN NOT NULL DEFAULT false,
    "gstRegistrationType" TEXT,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profiles" (
    "id" SERIAL NOT NULL,
    "legalName" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "tan" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'IN',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_documents" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "payload" JSONB,
    "remarks" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_events" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "details" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_vendorId_key" ON "vendor_profiles"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_gstin_key" ON "vendor_profiles"("gstin");

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_events" ADD CONSTRAINT "compliance_events_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "compliance_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
