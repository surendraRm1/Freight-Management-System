const freezeEnum = (values) => Object.freeze(values.reduce((acc, value) => {
  acc[value] = value;
  return acc;
}, {}));

const Role = freezeEnum([
  'SUPER_ADMIN',
  'ADMIN',
  'COMPANY_ADMIN',
  'FINANCE_APPROVER',
  'OPERATIONS',
  'TRANSPORTER',
  'AGENT',
  'USER',
]);

const ApprovalStatus = freezeEnum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

const ShipmentStatus = freezeEnum([
  'PENDING',
  'PENDING_QUOTE',
  'QUOTE_SUBMITTED',
  'QUOTE_APPROVED',
  'REQUESTED',
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
]);

const QuoteStatus = freezeEnum([
  'PENDING',
  'RESPONDED',
  'APPROVED',
  'CLOSED',
]);

const QuoteResponseStatus = freezeEnum([
  'PENDING',
  'RESPONDED',
  'APPROVED',
  'DECLINED',
]);

const ConsentStatus = freezeEnum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
]);

const ConsentSource = freezeEnum([
  'TRANSPORTER_PORTAL',
  'TRANSPORTER_APP',
  'SYSTEM',
]);

const BookingStatus = freezeEnum([
  'PENDING_TRANSPORTER',
  'CONFIRMED',
  'DECLINED',
  'EXPIRED',
]);

const PaymentStatus = freezeEnum([
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
]);

const InvoiceStatus = freezeEnum([
  'DRAFT',
  'ISSUED',
  'PAID',
]);

const ComplianceStatus = freezeEnum([
  'PENDING',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EXEMPT',
]);

const DocumentType = freezeEnum([
  'GST_INVOICE',
  'SELF_INVOICE_RCM',
  'EWAY_BILL',
  'DRIVER_KYC',
  'VEHICLE_KYC',
  'LORRY_RECEIPT',
]);

const SyncStatus = freezeEnum([
  'PENDING',
  'PROCESSING',
  'SUCCESS',
  'ERROR',
]);

module.exports = {
  Role,
  ApprovalStatus,
  ShipmentStatus,
  QuoteStatus,
  QuoteResponseStatus,
  ConsentStatus,
  ConsentSource,
  BookingStatus,
  PaymentStatus,
  InvoiceStatus,
  ComplianceStatus,
  DocumentType,
  SyncStatus,
};
