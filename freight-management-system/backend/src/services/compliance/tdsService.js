const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');
const { isRCMApplicable, calculateRcmLiability } = require('./rcmService');

const calculateTDS = ({ amount, vendorProfile }) => {
  if (!amount || amount <= 0) {
    return 0;
  }

  const threshold = Number(process.env.TDS_THRESHOLD || 30000);
  if (amount < threshold) {
    return 0;
  }

  const rate = Number(process.env.TDS_RATE || 1);
  return Number(((amount * rate) / 100).toFixed(2));
};

const calculateTCS = ({ amount }) => {
  if (!amount || amount <= 0) {
    return 0;
  }

  const rate = Number(process.env.TCS_RATE || 0.1);
  return Number(((amount * rate) / 100).toFixed(2));
};

const applyTaxDeductions = async (paymentId) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      shipment: {
        include: {
          vendor: true,
        },
      },
    },
  });

  if (!payment) {
    throw new Error('Payment not found.');
  }

  const vendorProfile = payment.shipment.selectedVendorId
    ? await prisma.vendorProfile.findUnique({ where: { vendorId: payment.shipment.selectedVendorId } })
    : null;

  const tdsAmount = calculateTDS({ amount: payment.amount, vendorProfile });
  const tcsAmount = calculateTCS({ amount: payment.amount });

  const rcmApplicable = isRCMApplicable({ vendorProfile, shipment: payment.shipment });
  const rcmLiability = rcmApplicable ? calculateRcmLiability(payment.amount) : 0;

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      tdsAmount,
      tcsAmount,
      rcmLiability,
    },
  });

  logger.info(
    `TDS/TCS updated for payment ${payment.id}; TDS=${tdsAmount}, TCS=${tcsAmount}, RCM=${rcmLiability}`,
  );
  return updated;
};

module.exports = {
  calculateTDS,
  calculateTCS,
  applyTaxDeductions,
};
