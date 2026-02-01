/*
  Warnings:

  - You are about to drop the column `vendorId` on the `shipments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_vendorId_fkey";

-- AlterTable
ALTER TABLE "shipments" DROP COLUMN "vendorId",
ADD COLUMN     "selectedVendorId" INTEGER;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_selectedVendorId_fkey" FOREIGN KEY ("selectedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
