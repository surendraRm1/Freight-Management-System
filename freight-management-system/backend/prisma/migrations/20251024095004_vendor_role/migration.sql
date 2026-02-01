-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'VENDOR';

-- AlterTable
ALTER TABLE "compliance_documents" ADD COLUMN     "paymentId" INTEGER;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "gstInvoiceId" INTEGER;

-- AddForeignKey
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
