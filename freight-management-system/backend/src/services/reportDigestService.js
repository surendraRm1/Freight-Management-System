const analyticsService = require('./analyticsService');
const financeAnalyticsService = require('./financeAnalyticsService');
const { generateCompanyDigestPdf } = require('../utils/pdfGenerator');
const prisma = require('../lib/prisma');
const logger = require('../utils/logger');
const { sendEmail } = require('../services/emailService');

const convertRowsToCsv = (rows) => {
  if (!rows || !rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvRows = [
    `# Generated at ${new Date().toISOString()}`,
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ];
  return csvRows.join('\n');
};

const buildDigestForCompany = async (company) => {
  const overview = await analyticsService.getCompanyOverview(company.id, { rangeDays: 30 });
  const finance = await financeAnalyticsService.getFinanceOverview(company.id);

  const pdfBuffer = generateCompanyDigestPdf({
    companyName: company.name,
    summary: overview.summary,
    insights: overview.insights,
  });

  const shipmentRows = overview.charts.shipmentsByDay.map((point) => ({
    date: point.date,
    count: point.count,
  }));
  const csvBuffer = Buffer.from(convertRowsToCsv(shipmentRows), 'utf8');

  const recipients =
    company.users
      ?.filter((user) => user.isActive && ['COMPANY_ADMIN', 'FINANCE_APPROVER'].includes(user.role))
      .map((user) => user.email)
      .filter(Boolean) || [];

  const fallbackRecipient = process.env.DIGEST_TEST_RECIPIENT;
  if (!recipients.length && fallbackRecipient) {
    recipients.push(fallbackRecipient);
  }

  if (!recipients.length) {
    logger.warn(`No recipients for company digest ${company.name}`);
    return;
  }

  await sendEmail({
    to: recipients.join(','),
    subject: `Daily digest · ${company.name}`,
    html: `
      <p>Hello,</p>
      <p>Your automated digest is ready. Key metrics:</p>
      <ul>
        <li>Total shipments: <strong>${overview.summary.shipments.total}</strong></li>
        <li>Quotes approved: <strong>${overview.summary.quotes.approved}</strong></li>
        <li>Invoices issued: <strong>${finance.invoiceStats?.ISSUED || 0}</strong></li>
      </ul>
      <p>The attached PDF contains the snapshot, and the CSV includes shipment trend data.</p>
    `,
    attachments: [
      { filename: 'company-digest.pdf', content: pdfBuffer },
      { filename: 'shipments-trend.csv', content: csvBuffer },
    ],
  });
};

const runDigestCycle = async () => {
  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        users: {
          select: { id: true, email: true, role: true, isActive: true },
        },
      },
    });

    for (const company of companies) {
      try {
        await buildDigestForCompany(company);
        logger.info(`Sent digest for company ${company.name}`);
      } catch (error) {
        logger.error(`Failed to send digest for company ${company.name}`, error);
      }
    }
  } catch (error) {
    logger.error('Digest cycle failed', error);
  }
};

let digestTimer;
const startReportDigestScheduler = () => {
  if (process.env.ENABLE_DIGESTS !== 'true') {
    logger.info('Report digest scheduler disabled.');
    return;
  }
  const minutes = Number(process.env.DIGEST_INTERVAL_MINUTES || 720);
  const intervalMs = minutes * 60 * 1000;
  logger.info(`Starting report digest scheduler (interval ${minutes} minutes).`);
  digestTimer = setInterval(runDigestCycle, intervalMs);
  runDigestCycle();
};

module.exports = {
  startReportDigestScheduler,
  _internal: { runDigestCycle },
};
