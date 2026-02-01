const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// This is a mock transporter. Replace with your actual email provider (e.g., SendGrid, Mailgun).
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendApprovalEmail = async (to, name, status) => {
  const subject = `Your KCO Account has been ${status}`;
  const html = `
    <p>Hi ${name},</p>
    <p>This is a notification to inform you that your account with KCO Freight Management has been <strong>${status.toLowerCase()}</strong>.</p>
    ${status === 'APPROVED'
      ? '<p>You can now log in to your account and access our services.</p>'
      : '<p>If you have any questions, please contact our support team.</p>'
    }
    <p>Thank you,<br/>The KCO Team</p>
  `;

  const mailOptions = {
    from: `"KCO Freight" <${process.env.EMAIL_FROM || 'noreply@kco.com'}>`,
    to,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  logger.info(`Email sent: ${info.messageId}`);
  // For testing with Ethereal, log the preview URL
  if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
    logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
};

module.exports = { sendApprovalEmail };