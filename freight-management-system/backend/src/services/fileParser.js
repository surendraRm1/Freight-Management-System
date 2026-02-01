const path = require('path');

/**
 * Simulate parsing a manifest (CSV/Excel) and return mock shipment data.
 * @param {string} filePath
 * @returns {Array<Object>} list of shipments
 */
const parseManifest = (filePath) => {
  if (!filePath) {
    return [];
  }

  const fileName = path.basename(filePath);

  return [
    {
      reference: 'MOCK-001',
      origin: 'New York, NY',
      destination: 'Los Angeles, CA',
      weightKg: 1200,
      pieces: 10,
      sourceFile: fileName
    },
    {
      reference: 'MOCK-002',
      origin: 'Chicago, IL',
      destination: 'Houston, TX',
      weightKg: 800,
      pieces: 6,
      sourceFile: fileName
    }
  ];
};

module.exports = {
  parseManifest
};
