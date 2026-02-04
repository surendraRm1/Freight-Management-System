const analyticsService = require('./analyticsService');

const publishSnapshot = async (companyId, targetUrl) => {
  const url = targetUrl || process.env.ANALYTICS_WEBHOOK_URL;
  if (!url) {
    throw new Error('No analytics webhook configured.');
  }
  const snapshot = await analyticsService.getCompanyOverview(companyId, { rangeDays: 30 });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Company-ID': String(companyId),
    },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Webhook responded with ${response.status}: ${body}`);
  }
  return snapshot.generatedAt;
};

module.exports = {
  publishSnapshot,
};
