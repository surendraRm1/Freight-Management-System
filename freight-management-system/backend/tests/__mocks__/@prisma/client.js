const ComplianceStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXEMPT: 'EXEMPT',
};

const DocumentType = {
  GST_INVOICE: 'GST_INVOICE',
  SELF_INVOICE_RCM: 'SELF_INVOICE_RCM',
  EWAY_BILL: 'EWAY_BILL',
  DRIVER_KYC: 'DRIVER_KYC',
  VEHICLE_KYC: 'VEHICLE_KYC',
  LORRY_RECEIPT: 'LORRY_RECEIPT',
};

class PrismaClient {
  constructor() {
    this.$disconnect = jest.fn();
  }
}

module.exports = {
  PrismaClient,
  ComplianceStatus,
  DocumentType,
};
