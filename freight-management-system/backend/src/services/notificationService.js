const prisma = require('../lib/prisma');
const logger = require('../utils/logger');
const { sendEmail } = require('./emailService');

const createNotification = async ({
  userId,
  title,
  message,
  type = 'SYSTEM',
  metadata,
}) => {
  if (!userId) {
    logger.warn('Attempted to create notification without a userId', { title });
    return null;
  }

  return prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      metadata,
    },
  });
};

const formatDateTime = (value) => (value
  ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  : null);

const notifyUserWithEmail = async ({
  user,
  title,
  message,
  metadata,
  emailSubject,
  emailBody,
  emailOverride = null,
}) => {
  if (!user) {
    logger.warn('Attempted to notify undefined user', { title });
    return;
  }

  await createNotification({
    userId: user.id,
    title,
    message,
    metadata,
  });

  const recipientEmail = emailOverride || user.email;

  if (recipientEmail && emailSubject && emailBody) {
    try {
      await sendEmail({
        to: recipientEmail,
        subject: emailSubject,
        html: emailBody,
      });
    } catch (error) {
      logger.error(`Failed to send notification email to ${user.email}`, error);
    }
  }
};

module.exports = {
  createNotification,
  notifyUserWithEmail,
  formatDateTime,
};
