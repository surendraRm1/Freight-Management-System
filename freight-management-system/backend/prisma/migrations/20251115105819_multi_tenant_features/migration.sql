/*
  Warnings:

  - You are about to drop the `agreements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `company_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `compliance_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `compliance_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `consent_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `drivers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quote_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quote_responses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rate_cards` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shipments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `status_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `system_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `vendor_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `vendors` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `companyId` to the `TransporterInvoice` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'FINANCE_APPROVER', 'OPERATIONS', 'TRANSPORTER', 'USER');

-- DropForeignKey
ALTER TABLE "TransporterInvoice" DROP CONSTRAINT "TransporterInvoice_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "agreements" DROP CONSTRAINT "agreements_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "agreements" DROP CONSTRAINT "agreements_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "compliance_documents" DROP CONSTRAINT "compliance_documents_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "compliance_documents" DROP CONSTRAINT "compliance_documents_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "compliance_events" DROP CONSTRAINT "compliance_events_documentId_fkey";

-- DropForeignKey
ALTER TABLE "consent_logs" DROP CONSTRAINT "consent_logs_quoteResponseId_fkey";

-- DropForeignKey
ALTER TABLE "consent_logs" DROP CONSTRAINT "consent_logs_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "drivers" DROP CONSTRAINT "drivers_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "payment_events" DROP CONSTRAINT "payment_events_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "quote_requests" DROP CONSTRAINT "quote_requests_approvedResponseId_fkey";

-- DropForeignKey
ALTER TABLE "quote_requests" DROP CONSTRAINT "quote_requests_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "quote_responses" DROP CONSTRAINT "quote_responses_quoteRequestId_fkey";

-- DropForeignKey
ALTER TABLE "quote_responses" DROP CONSTRAINT "quote_responses_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "rate_cards" DROP CONSTRAINT "rate_cards_agreementId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_agreementId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_quoteRequestId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_rateCardId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_selectedVendorId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_transporterQuoteId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_userId_fkey";

-- DropForeignKey
ALTER TABLE "status_history" DROP CONSTRAINT "status_history_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "status_history" DROP CONSTRAINT "status_history_updatedBy_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "vendor_profiles" DROP CONSTRAINT "vendor_profiles_vendorId_fkey";

-- AlterTable
ALTER TABLE "TransporterInvoice" ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "companyId" TEXT NOT NULL,
ALTER COLUMN "shipmentId" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "agreements";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "company_profiles";

-- DropTable
DROP TABLE "compliance_documents";

-- DropTable
DROP TABLE "compliance_events";

-- DropTable
DROP TABLE "consent_logs";

-- DropTable
DROP TABLE "drivers";

-- DropTable
DROP TABLE "invoices";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "payment_events";

-- DropTable
DROP TABLE "payments";

-- DropTable
DROP TABLE "quote_requests";

-- DropTable
DROP TABLE "quote_responses";

-- DropTable
DROP TABLE "rate_cards";

-- DropTable
DROP TABLE "shipments";

-- DropTable
DROP TABLE "status_history";

-- DropTable
DROP TABLE "system_settings";

-- DropTable
DROP TABLE "users";

-- DropTable
DROP TABLE "vendor_profiles";

-- DropTable
DROP TABLE "vendors";

-- DropEnum
DROP TYPE "BookingStatus";

-- DropEnum
DROP TYPE "ComplianceStatus";

-- DropEnum
DROP TYPE "ConsentSource";

-- DropEnum
DROP TYPE "ConsentStatus";

-- DropEnum
DROP TYPE "DocumentType";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "QuoteResponseStatus";

-- DropEnum
DROP TYPE "QuoteStatus";

-- DropEnum
DROP TYPE "ShipmentStatus";

-- DropEnum
DROP TYPE "ShipmentType";

-- DropEnum
DROP TYPE "Urgency";

-- DropEnum
DROP TYPE "UserApprovalStatus";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'standard',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "billingEmail" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'New',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "erp_order_id" TEXT,
    "pod_status" TEXT NOT NULL DEFAULT 'Pending',
    "pod_url" TEXT,
    "pod_notes" TEXT,
    "customer_name" TEXT NOT NULL,
    "pickup_details" JSONB NOT NULL,
    "delivery_details" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignedToId" TEXT,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_companyId_erp_order_id_key" ON "Shipment"("companyId", "erp_order_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransporterInvoice" ADD CONSTRAINT "TransporterInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransporterInvoice" ADD CONSTRAINT "TransporterInvoice_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransporterInvoice" ADD CONSTRAINT "TransporterInvoice_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
