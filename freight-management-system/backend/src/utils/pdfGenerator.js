const PDFDocument = require('pdfkit');

const generateCompanyDigestPdf = ({ companyName, summary, insights }) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  doc.fontSize(20).text(`${companyName} — Daily Operations Digest`, { align: 'left' });
  doc.moveDown();
  doc.fontSize(10).fillColor('gray').text(`Generated at ${new Date().toLocaleString()}`);
  doc.moveDown(1.5);

  doc.fillColor('black').fontSize(14).text('Shipment Summary', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`Total shipments: ${summary.shipments.total}`);
  doc.text(`In transit: ${summary.shipments.inTransit}`);
  doc.text(`Delivered: ${summary.shipments.delivered}`);
  doc.text(`Pending: ${summary.shipments.pending}`);
  doc.moveDown();

  doc.fontSize(14).text('Quote Funnel', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`Requested: ${summary.quotes.requested}`);
  doc.text(`Responded: ${summary.quotes.responded}`);
  doc.text(`Approved: ${summary.quotes.approved}`);
  doc.moveDown();

  if (insights?.vendorScorecards?.length) {
    doc.fontSize(14).text('Top Vendors', { underline: true });
    doc.moveDown(0.5);
    insights.vendorScorecards.slice(0, 3).forEach((vendor, index) => {
      doc
        .fontSize(12)
        .text(
          `${index + 1}. ${vendor.name} — Shipments: ${vendor.totalShipments}, Delivery rate: ${vendor.deliveryRate}%`,
        );
    });
    doc.moveDown();
  }

  if (insights?.alerts?.length) {
    doc.fontSize(14).text('Alerts', { underline: true });
    doc.moveDown(0.5);
    insights.alerts.forEach((alert) => {
      doc
        .fontSize(12)
        .text(
          `• Shipment ${alert.trackingNumber || alert.id} delayed (${alert.status}) — ${alert.fromLocation} → ${
            alert.toLocation
          }`,
        );
    });
    doc.moveDown();
  }

  doc.end();
  return Buffer.concat(chunks);
};

module.exports = {
  generateCompanyDigestPdf,
};
