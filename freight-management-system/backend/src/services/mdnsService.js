const os = require('os');
const BonjourService = require('bonjour-service');
const logger = require('../utils/logger');

let bonjourInstance = null;
let publishedService = null;

const getLanIp = () => {
  const interfaces = os.networkInterfaces();
  for (const items of Object.values(interfaces)) {
    if (!items) continue;
    for (const item of items) {
      if (!item || item.internal || item.family !== 'IPv4') continue;
      if (/^(127\.|169\.254\.)/.test(item.address)) continue;
      return item.address;
    }
  }
  return null;
};

const start = () => {
  if (process.env.ENABLE_MDNS === 'false') {
    logger.info('mDNS broadcasting disabled via ENABLE_MDNS flag.');
    return;
  }

  const port = Number(process.env.PORT || 5000);
  const name = process.env.MDNS_SERVICE_NAME || 'FreightSystem';
  const txt = {
    host: os.hostname(),
    ip: getLanIp() || '127.0.0.1',
    updatedAt: new Date().toISOString(),
    shareName: process.env.SHARED_FOLDER_NAME || 'SharedDatabase',
  };

  const BonjourCtor = BonjourService.Bonjour || BonjourService.default || BonjourService;
  bonjourInstance = new BonjourCtor();
  publishedService = bonjourInstance.publish({
    name: `${name} (${txt.host})`,
    type: 'http',
    port,
    txt,
  });

  publishedService.on('up', () => logger.info('mDNS service advertisement confirmed.'));
  publishedService.on('error', (error) => logger.warn('mDNS service error', { error }));

  logger.info(`mDNS broadcasting enabled for ${name}._http._tcp.local on port ${port}`);
};

const stop = () => {
  try {
    if (publishedService) {
      publishedService.stop();
      publishedService = null;
    }
    if (bonjourInstance) {
      bonjourInstance.destroy();
      bonjourInstance = null;
    }
  } catch (error) {
    logger.warn('Failed to stop mDNS service', { error });
  }
};

module.exports = {
  start,
  stop,
};
