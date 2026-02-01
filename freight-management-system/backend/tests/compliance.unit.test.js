jest.mock('@prisma/client');

const { buildGSTPayload } = require('../src/services/compliance/gstService');
const {
  calculateTDS,
  calculateTCS,
} = require('../src/services/compliance/tdsService');
const {
  isRCMApplicable,
  calculateRcmLiability,
} = require('../src/services/compliance/rcmService');

describe('GST payload builder', () => {
  const baseShipment = {
    id: 42,
    fromLocation: 'Delhi',
    toLocation: 'Mumbai',
    cost: 125000,
    notes: 'Fragile cargo',
    vendor: { name: 'SpeedTrans' },
  };

  it('creates a payload with company and vendor defaults', () => {
    process.env.DEFAULT_GST_RATE = '18';
    process.env.DEFAULT_GST_HSN = '996511';
    process.env.COMPANY_GSTIN = '22AAAAA0000A1Z5';
    process.env.COMPANY_LEGAL_NAME = 'Freight Corp';

    const payload = buildGSTPayload({
      shipment: baseShipment,
      companyProfile: null,
      vendorProfile: null,
    });

    expect(payload.documentType).toBe('GST_INVOICE');
    expect(payload.invoice.lineItems).toHaveLength(1);
    expect(payload.invoice.lineItems[0]).toMatchObject({
      description: 'Freight for Delhi -> Mumbai',
      hsn: '996511',
      taxRate: 18,
      amount: baseShipment.cost,
    });
    expect(payload.supplier.legalName).toBe('Freight Corp');
    expect(payload.recipient.legalName).toBe('SpeedTrans');
  });

  it('prioritises structured profiles over environment defaults', () => {
    const payload = buildGSTPayload({
      shipment: baseShipment,
      companyProfile: {
        legalName: 'KCO Logistics Pvt Ltd',
        gstin: '33BBBBB0000B1Z6',
        addressLine1: 'Plot 21',
        city: 'Chennai',
        state: 'TN',
        postalCode: '600001',
      },
      vendorProfile: {
        legalName: 'SpeedTrans India',
        gstin: '07CCCCC0000C1Z7',
        addressLine1: 'NH8 Yard',
        city: 'Gurugram',
        state: 'HR',
        postalCode: '122001',
      },
    });

    expect(payload.supplier).toMatchObject({
      legalName: 'KCO Logistics Pvt Ltd',
      gstin: '33BBBBB0000B1Z6',
      address: expect.objectContaining({
        city: 'Chennai',
        state: 'TN',
      }),
    });

    expect(payload.recipient).toMatchObject({
      legalName: 'SpeedTrans India',
      gstin: '07CCCCC0000C1Z7',
      address: expect.objectContaining({
        city: 'Gurugram',
        state: 'HR',
      }),
    });
  });
});

describe('TDS & TCS calculators', () => {
  beforeEach(() => {
    process.env.TDS_THRESHOLD = '30000';
    process.env.TDS_RATE = '1';
    process.env.TCS_RATE = '0.1';
  });

  it('returns zero for payments below the TDS threshold', () => {
    expect(calculateTDS({ amount: 29999.99 })).toBe(0);
  });

  it('applies configured percentage for TDS and rounds to paise precision', () => {
    const amount = 75500.5;
    const expected = Number(((amount * 1) / 100).toFixed(2));
    expect(calculateTDS({ amount })).toBe(expected);
  });

  it('calculates TCS using default rate', () => {
    const amount = 50250;
    const expected = Number(((amount * 0.1) / 100).toFixed(2));
    expect(calculateTCS({ amount })).toBe(expected);
  });
});

describe('RCM evaluator', () => {
  const shipment = {
    status: 'ASSIGNED',
    cost: 100000,
  };

  it('returns false when vendor profile is missing', () => {
    expect(isRCMApplicable({ vendorProfile: null, shipment })).toBe(false);
  });

  it('returns true when vendor is explicitly marked RCM eligible', () => {
    expect(
      isRCMApplicable({
        vendorProfile: { rcmEligible: true },
        shipment,
      }),
    ).toBe(true);
  });

  it('returns false for completed or cancelled shipments', () => {
    expect(
      isRCMApplicable({
        vendorProfile: { rcmEligible: true },
        shipment: { ...shipment, status: 'DELIVERED' },
      }),
    ).toBe(false);
  });

  it('computes RCM liability based on configured rate', () => {
    process.env.RCM_RATE = '5';
    expect(calculateRcmLiability(250000)).toBe(12500);
  });

  it('handles zero or undefined shipment cost gracefully', () => {
    expect(calculateRcmLiability(null)).toBe(0);
    expect(calculateRcmLiability(0)).toBe(0);
  });
});
