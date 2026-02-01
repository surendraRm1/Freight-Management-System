const twilio = require('twilio');
const logger = require('../utils/logger');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER || process.env.SENDER_PHONE_NUMBER;

const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

const buildBody = (template, context = {}) => {
  if (context.body) return context.body;
  if (context.message) return context.message;
  if (template) return `FMS Alert: ${template}`;
  return 'Freight Management System notification';
};

const sendSMS = async ({ to, template, context = {} }) => {
  if (!to) {
    logger.warn('smsService.sendSMS called without destination number', { template, context });
    return null;
  }

  const body = buildBody(template, context);

  if (!twilioClient || !fromNumber) {
    logger.warn('Twilio credentials or from number missing; SMS logged but not sent', {
      to,
      template,
      body,
    });
    return {
      to,
      template,
      context,
      body,
      sentAt: new Date(),
      provider: 'mock',
    };
  }

  try {
    const response = await twilioClient.messages.create({
      to,
      from: fromNumber,
      body,
    });
    logger.info(`SMS sent via Twilio`, { sid: response.sid, to });
    return response;
  } catch (error) {
    logger.error('Failed to send SMS via Twilio', { error: error.message, to });
    throw error;
  }
};

module.exports = {
  sendSMS,
};
