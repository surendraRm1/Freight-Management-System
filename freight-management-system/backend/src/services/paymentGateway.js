const logger = require('../utils/logger');

// Simple mock gateway that simulates authorize/capture/refund.
const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldFail = (flag) => typeof flag === 'string' && flag.toLowerCase() === 'fail';

const authorize = async ({ amount, currency = 'INR', metadata = {} }) => {
  await delay();
  if (shouldFail(process.env.PAYMENT_GATEWAY_FORCE)) {
    logger.warn('Mock gateway authorization failed via flag.');
    return {
      success: false,
      status: 'FAILED',
      transactionRef: null,
      failureReason: 'Mock gateway configured to fail.',
      raw: metadata,
    };
  }

  const ref = `MOCK-AUTH-${Date.now()}`;
  logger.info(`Mock gateway authorized amount ${amount} ${currency} ref=${ref}`);
  return {
    success: true,
    status: 'AUTHORIZED',
    transactionRef: ref,
    raw: metadata,
  };
};

const capture = async ({ transactionRef }) => {
  await delay();
  if (!transactionRef) {
    return {
      success: false,
      status: 'FAILED',
      failureReason: 'Missing transaction reference',
    };
  }
  if (shouldFail(process.env.PAYMENT_GATEWAY_FORCE_CAPTURE)) {
    return {
      success: false,
      status: 'FAILED',
      failureReason: 'Mock capture failure via flag',
    };
  }
  logger.info(`Mock gateway captured transaction ${transactionRef}`);
  return {
    success: true,
    status: 'PAID',
    transactionRef,
  };
};

const refund = async ({ transactionRef, amount }) => {
  await delay();
  logger.info(`Mock gateway refunded ${amount} for ${transactionRef}`);
  return {
    success: true,
    status: 'REFUNDED',
    transactionRef,
  };
};

module.exports = {
  authorize,
  capture,
  refund,
};
