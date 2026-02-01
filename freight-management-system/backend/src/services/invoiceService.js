const logger = require('../utils/logger');

const nextInvoiceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  return `INV-${year}-${now.getTime()}`;
};

const buildLineItems = ({ shipment, taxes = [] }) => {
  const items = [
    {
      description: `Freight for ${shipment.fromLocation} -> ${shipment.toLocation}`,
      quantity: 1,
      unitPrice: shipment.cost || 0,
      total: shipment.cost || 0,
    },
  ];

  taxes.forEach((tax) => {
    items.push({
      description: tax.label,
      quantity: 1,
      unitPrice: tax.amount,
      total: tax.amount,
    });
  });

  return items;
};

const calculateTotals = (items) =>
  items.reduce(
    (accumulator, item) => {
      const isTax = item.description.toLowerCase().includes('tax');
      return {
        subtotal: accumulator.subtotal + (isTax ? 0 : item.total),
        taxTotal: accumulator.taxTotal + (isTax ? item.total : 0),
      };
    },
    { subtotal: 0, taxTotal: 0 },
  );

const createInvoiceDraft = ({ shipment, taxes = [] }) => {
  if (!shipment) {
    throw new Error('Shipment is required to generate invoice');
  }

  const lineItems = buildLineItems({ shipment, taxes });
  const totals = calculateTotals(lineItems);
  const grandTotal = totals.subtotal + totals.taxTotal;

  const invoice = {
    invoiceNumber: nextInvoiceNumber(),
    lineItems,
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    grandTotal,
    issuedAt: null,
    dueDate: null,
  };

  logger.info(`Invoice draft created for shipment ${shipment.id} total=${grandTotal}`);
  return invoice;
};

module.exports = {
  nextInvoiceNumber,
  createInvoiceDraft,
};
