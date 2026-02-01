const nodemailer = require('nodemailer');
const escapeHtml = require('escape-html');
const logger = require('../utils/logger');

// Mockable transporter: replace with production credentials when ready.
// Mockable transporter: replace with production credentials when ready.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  // Force secure if port is 465, otherwise rely on env var or default to false
  secure: process.env.SMTP_PORT == 465 || process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: `"KCO Freight" <${process.env.EMAIL_FROM || 'noreply@kco.com'}>`,
    to,
    subject,
    html,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
      logger.info(`Ethereal preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    return info;
  } catch (error) {
    logger.error(`Failed to send email to ${to}`, error);
    throw error;
  }
};

const sendPasswordResetEmail = async (to, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

  await sendEmail({
    to,
    subject: 'Password Reset Request',
    html: `
      <p>You requested a password reset for your account.</p>
      <p>Click the link below to set a new password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });
};

const sendTwoFactorCodeEmail = async (to, code) => {
  await sendEmail({
    to,
    subject: 'Your verification code',
    html: `
      <p>Use the verification code below to continue logging in:</p>
      <p style="font-size: 24px; letter-spacing: 0.25em;"><strong>${escapeHtml(code)}</strong></p>
      <p>This code will expire in a few minutes for your security.</p>
    `,
  });
};

const sendApprovalEmail = async (to, name, status) => {
  const subject = `Your KCO Account has been ${status}`;
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your account with KCO Freight Management has been <strong>${escapeHtml(status.toLowerCase())}</strong>.</p>
    ${status === 'APPROVED'
      ? '<p>You can now log in to your account and access our services.</p>'
      : '<p>If you have any questions, please contact our support team.</p>'
    }
    <p>Thank you,<br/>The KCO Team</p>
  `;

  await sendEmail({ to, subject, html });
};

const sendRoleChangeEmail = async (to, name, newRole) => {
  const subject = 'Your Account Role has been Updated';
  let roleDetails = `Your account role has been updated to: <strong>${newRole}</strong>.`;

  if (newRole === 'VENDOR') {
    roleDetails += '<p>As a transporter, you are now eligible to have service agreements created for you in our system.</p>';
  }

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>This is a notification to inform you of an update to your KCO Freight Management account.</p>
    <p>${roleDetails}</p>
    <p>If you have any questions, please contact an administrator.</p>
    <p>Thank you,<br/>The KCO Team</p>
  `;

  await sendEmail({ to, subject, html });
};

const sendShipmentDeliveredEmail = async (to, name, shipment) => {
  const subject = `Your Shipment has been Delivered! (Tracking: ${shipment.trackingNumber})`;
  const deliveryDate = shipment.deliveryTime
    ? new Date(shipment.deliveryTime).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })
    : 'N/A';

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Great news! Your shipment from <strong>${escapeHtml(shipment.fromLocation)}</strong> to <strong>${escapeHtml(shipment.toLocation)}</strong> has been successfully delivered.</p>
    <ul>
      <li><strong>Tracking Number:</strong> ${escapeHtml(shipment.trackingNumber)}</li>
      <li><strong>Delivered On:</strong> ${escapeHtml(deliveryDate)}</li>
    </ul>
    <p>Thank you for using KCO Freight Management.</p>
  `;

  await sendEmail({ to, subject, html });
};

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null;

const formatCurrency = (value, currency = 'INR') => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A';
  }

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch (error) {
    logger.warn('Currency formatting failed, falling back to plain number', error);
    return `${Number(value).toFixed(2)} ${currency}`;
  }
};

const sendQuoteRequestInvitationEmail = async ({
  to,
  vendorName,
  shipperName,
  fromLocation,
  toLocation,
  weight,
  shipmentType,
  urgency,
  notes,
  quoteId,
}) => {
  const subject = 'New Quote Request Waiting For Your Response';
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const redirectPath = '/transporter/quotes';
  const loginUrl = `${baseUrl}/login?redirect=${encodeURIComponent(redirectPath)}`;
  const meta = [
    shipperName ? `<li><strong>Requested by:</strong> ${escapeHtml(shipperName)}</li>` : '',
    `<li><strong>Route:</strong> ${escapeHtml(fromLocation)} &rarr; ${escapeHtml(toLocation)}</li>`,
    weight ? `<li><strong>Weight:</strong> ${Number(weight).toLocaleString('en-IN')} kg</li>` : '',
    shipmentType ? `<li><strong>Mode:</strong> ${escapeHtml(shipmentType.replace(/_/g, ' '))}</li>` : '',
    urgency ? `<li><strong>Urgency:</strong> ${escapeHtml(urgency.replace(/_/g, ' '))}</li>` : '',
    quoteId ? `<li><strong>Quote reference:</strong> QT-${escapeHtml(String(quoteId))}</li>` : '',
  ]
    .filter(Boolean)
    .join('');

  const html = `
    <div style="margin:0;padding:24px;background:#eef3ff;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;box-shadow:0 12px 32px rgba(15,23,42,0.08);overflow:hidden;">
        <tr>
          <td style="padding:28px 32px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;">
            <h1 style="margin:0;font-size:22px;font-weight:700;">New quote request</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">${escapeHtml(shipperName || 'A shipper')} is waiting for your rates.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(vendorName || 'Transporter')},</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569;">You have been invited to submit pricing for the shipment outlined below. Review the details and log in to share your rates and ETAs.</p>
            <div style="margin:0 0 20px;padding:18px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
              <p style="margin:0 0 12px;font-weight:600;font-size:14px;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.08em;">Shipment snapshot</p>
              <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#334155;">
                ${meta}
              </ul>
              ${notes ? `<p style="margin:14px 0 0;font-size:13px;color:#475569;"><strong>Special instructions:</strong> ${escapeHtml(notes)}</p>` : ''}
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td>
                  <a href="${loginUrl}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 10px 20px rgba(37,99,235,0.25);">
                    Login to respond
                  </a>
                </td>
              </tr>
            </table>
            <div style="padding:16px;border-radius:12px;background:#f1f5f9;font-size:12px;color:#475569;line-height:1.5;">
              <strong style="display:block;color:#1f2937;margin-bottom:4px;">Download-ready records</strong>
              All quote trails, shipment documents, and analytics are exportable from your dashboard in PDF, CSV, or JSON whenever you need local copies.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center;">
            © ${new Date().getFullYear()} KCO Freight Operations
          </td>
        </tr>
      </table>
    </div>
  `;

  await sendEmail({ to, subject, html });
};

const sendTransporterInviteEmail = async ({
  to,
  transporterName,
  vendorName,
  tempPassword,
  portalUrl,
}) => {
  const subject = 'Your KCO Freight transporter portal access';
  const safeName = transporterName || vendorName || 'there';
  const html = `
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;box-shadow:0 12px 30px rgba(15,23,42,0.12);overflow:hidden;">
        <tr>
          <td style="padding:28px 32px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#ffffff;">
            <h1 style="margin:0;font-size:22px;font-weight:700;">Welcome to KCO Freight</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Your ${vendorName || 'transporter'} account is ready.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(safeName)},</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#475569;">
              The operations team has created a transporter login for you. Use the credentials below to access the portal,
              review pending quote requests, and confirm shipments assigned to <strong>${escapeHtml(vendorName || 'your fleet')}</strong>.
            </p>
            <div style="margin:0 0 20px;padding:20px;border:1px solid #e2e8f0;border-radius:14px;background:#f1f5f9;">
              <p style="margin:0 0 12px;font-weight:600;font-size:14px;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.08em;">Login details</p>
              <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#1f2937;">
                <li><strong>Portal:</strong> <a href="${portalUrl}" style="color:#2563eb;text-decoration:none;">${portalUrl}</a></li>
                <li><strong>Username:</strong> ${escapeHtml(to)}</li>
                <li><strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</li>
              </ul>
              <p style="margin:14px 0 0;font-size:12px;color:#64748b;">For security, please sign in immediately and choose <em>Change password</em> under your profile.</p>
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td>
                  <a href="${portalUrl}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 10px 20px rgba(37,99,235,0.25);">
                    Open transporter portal
                  </a>
                </td>
              </tr>
            </table>
            <div style="padding:16px;border-radius:12px;background:#f8fafc;font-size:12px;color:#475569;line-height:1.5;">
              Need help? Reply to this email or reach the KCO operations desk for assistance with your account.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#e2e8f0;color:#64748b;font-size:12px;text-align:center;">
            © ${new Date().getFullYear()} KCO Freight Operations. All rights reserved.
          </td>
        </tr>
      </table>
    </div>
  `;

  await sendEmail({ to, subject, html });
};

const sendBookingConsentRequestEmail = async ({
  to,
  vendorName,
  fromLocation,
  toLocation,
  quotedPrice,
  expiresAt,
  shipperName,
  shipperEmail,
  shipmentId,
  trackingNumber,
  weight,
  shipmentType,
  urgency,
  estimatedDelivery,
}) => {
  const subject = 'New Booking Confirmation Awaiting Your Approval';
  const expiryLabel = formatDateTime(expiresAt) || 'the specified SLA window';
  const etaLabel = formatDateTime(estimatedDelivery);
  const valueLabel = formatCurrency(quotedPrice);
  const jobReference = trackingNumber || (shipmentId ? `SHP-${shipmentId}` : 'Pending assignment');
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const redirectPath = '/transporter/inbox';
  const loginUrl = `${baseUrl}/login?redirect=${encodeURIComponent(redirectPath)}`;

  const shipmentMeta = [
    shipperName ? `<li><strong>Requested by:</strong> ${escapeHtml(shipperName)}</li>` : '',
    shipperEmail
      ? `<li><strong>Contact email:</strong> <a href="mailto:${escapeHtml(shipperEmail)}">${escapeHtml(shipperEmail)}</a></li>`
      : '',
    jobReference ? `<li><strong>Shipment reference:</strong> ${escapeHtml(jobReference)}</li>` : '',
    weight ? `<li><strong>Weight:</strong> ${Number(weight).toLocaleString('en-IN')} kg</li>` : '',
    shipmentType ? `<li><strong>Mode:</strong> ${escapeHtml(shipmentType.replace(/_/g, ' '))}</li>` : '',
    urgency ? `<li><strong>Urgency:</strong> ${escapeHtml(urgency.replace(/_/g, ' '))}</li>` : '',
    valueLabel !== 'N/A' ? `<li><strong>Approved value:</strong> ${escapeHtml(valueLabel)}</li>` : '',
    etaLabel ? `<li><strong>Expected delivery:</strong> ${escapeHtml(etaLabel)}</li>` : '',
    `<li><strong>Consent deadline:</strong> ${escapeHtml(expiryLabel)}</li>`,
  ]
    .filter(Boolean)
    .join('');

  const html = `
    <div style="margin:0;padding:24px;background:#ecfdf5;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;box-shadow:0 12px 32px rgba(15,23,42,0.08);overflow:hidden;">
        <tr>
          <td style="padding:28px 32px;background:linear-gradient(135deg,#10b981,#047857);color:#ffffff;">
            <h1 style="margin:0;font-size:22px;font-weight:700;">Action needed: confirm shipment</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Lock in the booking before the consent window closes.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(vendorName || 'Transporter')},</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569;">The shipment from <strong>${escapeHtml(fromLocation)}</strong> to <strong>${escapeHtml(toLocation)}</strong> has been approved with your quoted value. Review the details below and confirm receipt to trigger dispatch.</p>
            <div style="margin:0 0 20px;padding:18px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
              <p style="margin:0 0 12px;font-weight:600;font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.08em;">Shipment snapshot</p>
              <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#334155;">
                ${shipmentMeta}
              </ul>
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td>
                  <a href="${loginUrl}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#10b981;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 10px 20px rgba(16,185,129,0.25);">
                    Login to confirm
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin:0 0 24px;padding:16px;border-radius:12px;background:#f1f5f9;font-size:13px;color:#475569;">
              <strong style="display:block;color:#0f172a;margin-bottom:6px;">What happens after acceptance?</strong>
              <ul style="margin:0;padding-left:18px;line-height:1.5;">
                <li>Dispatch coordination and compliance reminders kick off automatically.</li>
                <li>The shipper receives instant confirmation and tracking updates.</li>
                <li>You can download every related document (quotes, invoices, analytics) anytime in PDF, CSV, or JSON.</li>
              </ul>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center;">
            Need assistance? Reply to this email or visit the support tab in your dashboard.<br/>
            © ${new Date().getFullYear()} KCO Freight Operations
          </td>
        </tr>
      </table>
    </div>
  `;

  await sendEmail({ to, subject, html });
};

const sendBookingConsentUpdateEmail = async ({
  to,
  recipientName,
  statusLabel,
  vendorName,
  fromLocation,
  toLocation,
  note,
  actionedAt,
  trackingNumber,
}) => {
  const subject = `Transporter ${statusLabel} Booking (${fromLocation} -> ${toLocation})`;
  const actionedLabel = formatDateTime(actionedAt);
  const html = `
    <p>Hi ${escapeHtml(recipientName || 'there')},</p>
    <p>Transporter <strong>${escapeHtml(vendorName)}</strong> has <strong>${escapeHtml(statusLabel.toLowerCase())}</strong> the shipment for <strong>${escapeHtml(fromLocation)}</strong> &rarr; <strong>${escapeHtml(toLocation)}</strong>.</p>
    ${trackingNumber ? `<p>Shipment reference: <strong>${escapeHtml(trackingNumber)}</strong></p>` : ''}
    ${actionedLabel ? `<p>Actioned at: ${escapeHtml(actionedLabel)}</p>` : ''}
    ${note ? `<p><strong>Transporter note:</strong> ${escapeHtml(note)}</p>` : ''}
    <p>Track the booking in your dashboard for next steps.</p>
    <p>Regards,<br/>KCO Freight Operations</p>
  `;

  await sendEmail({ to, subject, html });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendShipmentDeliveredEmail,
  sendRoleChangeEmail,
  sendApprovalEmail,
  sendTransporterInviteEmail,
  sendQuoteRequestInvitationEmail,
  sendBookingConsentRequestEmail,
  sendBookingConsentUpdateEmail,
  sendTwoFactorCodeEmail,
};
