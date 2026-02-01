/*
  Warnings:

  - A unique constraint covering the columns `[erp_order_id]` on the table `shipments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "erp_order_id" TEXT,
ADD COLUMN     "pod_notes" TEXT,
ADD COLUMN     "pod_status" TEXT NOT NULL DEFAULT 'Pending',
ADD COLUMN     "pod_url" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "drivers" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "licenseNumber" TEXT,
    "vehicleNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransporterInvoice" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "invoice_amount" DOUBLE PRECISION NOT NULL,
    "invoice_url" TEXT NOT NULL,
    "approval_status" TEXT NOT NULL DEFAULT 'Pending',
    "rejection_notes" TEXT,
    "posted_to_erp_at" TIMESTAMP(3),
    "shipmentId" INTEGER NOT NULL,

    CONSTRAINT "TransporterInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drivers_vendorId_isActive_idx" ON "drivers"("vendorId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_erp_order_id_key" ON "shipments"("erp_order_id");

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransporterInvoice" ADD CONSTRAINT "TransporterInvoice_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
