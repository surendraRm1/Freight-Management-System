#!/usr/bin/env node
/**
 * Freight Management System - System Configuration Helper
 *
 * - Guides the operator to pick the database backend.
 * - Detects if the machine is connected to Wi-Fi and, if so, enables multi-user access defaults.
 * - Updates the backend .env file with the correct compatibility flags so the database/API can be shared.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

const ENV_PATH = path.resolve(__dirname, '..', '.env');

const readFileSafe = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
};

const envRaw = readFileSafe(ENV_PATH);
const envMap = envRaw ? dotenv.parse(envRaw) : {};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question, defaultValue) =>
  new Promise((resolve) => {
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`${question}${suffix}: `, (answer) => {
      const normalized = answer.trim();
      if (!normalized && defaultValue !== undefined) {
        resolve(defaultValue);
      } else {
        resolve(normalized);
      }
    });
  });

const detectWifi = () => {
  const info = { connected: false, ssid: null };
  try {
    if (process.platform === 'win32') {
      const output = execSync('netsh wlan show interfaces', { encoding: 'utf8' });
      info.connected = /State\s*:\s*connected/i.test(output);
      const ssidMatch = output.match(/^\s*SSID\s*:\s*(.+)$/im);
      if (ssidMatch) {
        info.ssid = ssidMatch[1].trim();
      }
      return info;
    }
    try {
      const nmcli = execSync('nmcli -t -f ACTIVE,SSID dev wifi', { encoding: 'utf8' });
      const activeLine = nmcli
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('yes:'));
      if (activeLine) {
        info.connected = true;
        info.ssid = activeLine.split(':')[1];
        return info;
      }
    } catch {
      // Ignore nmcli errors and attempt iwgetid.
    }
    const iwgetid = execSync('iwgetid -r', { encoding: 'utf8' }).trim();
    if (iwgetid) {
      info.connected = true;
      info.ssid = iwgetid;
    }
  } catch {
    // Unable to detect Wi-Fi status; fall back to network interface inspection.
  }
  return info;
};

const getPrivateLanIp = () => {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(entry.address)) {
        return entry.address;
      }
    }
  }
  return null;
};

const formatValue = (value) => {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value === undefined || value === null) {
    return '""';
  }
  const needsQuotes = /[\s#"'=]/.test(value);
  const sanitized = value.replace(/"/g, '\\"');
  return needsQuotes ? `"${sanitized}"` : sanitized;
};

const upsertEnvValue = (content, key, rawValue, comment) => {
  const value = formatValue(rawValue);
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const prefix = comment ? `\n# ${comment}\n` : '\n';
  return `${content.trimEnd()}${prefix}${line}\n`;
};

const updateEnvFile = (updates) => {
  let nextContent = envRaw || '';
  if (!nextContent.includes('# Backend Environment Configuration')) {
    nextContent = envRaw || '';
  }
  Object.entries(updates).forEach(([key, update]) => {
    const { value, comment } = update;
    nextContent = upsertEnvValue(nextContent || '', key, value, comment);
  });
  fs.writeFileSync(ENV_PATH, `${nextContent.trimEnd()}\n`);
};

const buildFrontendUrls = (lanHost) => {
  const existing = envMap.FRONTEND_URLS || envMap.FRONTEND_URL || 'http://localhost:5173';
  const urls = new Set(
    existing
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
  urls.add('http://localhost:5173');
  if (lanHost) {
    urls.add(`http://${lanHost}:5173`);
  }
  return Array.from(urls).join(',');
};

const main = async () => {
  console.log('🛠  Freight Management System – System Configuration\n');

  const dbDefaultChoice = envMap.DATABASE_PROVIDER === 'sqlite' ? '2' : '1';
  const dbChoice = (await ask('Select database provider [1=PostgreSQL, 2=SQLite]', dbDefaultChoice)).trim();

  let databaseProvider = 'postgresql';
  let databaseUrl =
    envMap.DATABASE_URL || 'postgresql://postgres:99665588@localhost:9581/freight-management-system';

  if (dbChoice === '2') {
    databaseProvider = 'sqlite';
    const sqliteDefault = envMap.DATABASE_URL?.startsWith('file:')
      ? envMap.DATABASE_URL.replace(/^file:/, '')
      : './data/freight.db';
    let sqlitePath = await ask('SQLite file path (relative or absolute)', sqliteDefault);
    if (!sqlitePath.startsWith('./') && !path.isAbsolute(sqlitePath)) {
      sqlitePath = `./${sqlitePath}`;
    }
    if (!sqlitePath.startsWith('file:')) {
      sqlitePath = `file:${sqlitePath}`;
    }
    databaseUrl = sqlitePath;
  } else {
    databaseProvider = 'postgresql';
    databaseUrl = await ask('PostgreSQL connection URL', databaseUrl);
    if (!databaseUrl.startsWith('postgresql://')) {
      console.warn('⚠️  Connection URL should start with postgresql:// – updating automatically.');
      databaseUrl = `postgresql://${databaseUrl.replace(/^\/+/, '')}`;
    }
  }

  const wifi = detectWifi();
  const lanIp = getPrivateLanIp();
  const multiUserAccess = wifi.connected && Boolean(lanIp);
  const compatibilityFlags = multiUserAccess
    ? 'allow-remote-clients,shared-cache,lan-broadcast'
    : 'single-user-mode';

  const updates = {
    DATABASE_PROVIDER: { value: databaseProvider, comment: 'Selected database provider' },
    DATABASE_URL: { value: databaseUrl, comment: 'Auto-configured by system agent' },
    MULTI_USER_ACCESS: {
      value: multiUserAccess,
      comment: 'Enables LAN-safe defaults when the machine is on a common Wi-Fi network',
    },
    MULTI_USER_SSID: {
      value: wifi.ssid || '',
      comment: 'SSID that triggered multi-user configuration (if available)',
    },
    NETWORK_LAN_HOST: {
      value: lanIp || '',
      comment: 'LAN address advertised to other devices for API access',
    },
    DATABASE_COMPAT_FLAGS: {
      value: compatibilityFlags,
      comment: 'Flags letting the backend know how to expose the database safely',
    },
    FRONTEND_URLS: {
      value: buildFrontendUrls(multiUserAccess ? lanIp : null),
      comment: 'Allowed origins for cross-device access',
    },
  };

  updateEnvFile(updates);

  rl.close();

  console.log('\n✅ Configuration updated.');
  console.log(`• Database provider: ${databaseProvider}`);
  console.log(`• Multi-user access: ${multiUserAccess ? 'enabled' : 'disabled'}`);
  if (multiUserAccess && lanIp) {
    console.log(`• LAN clients can reach the API via http://${lanIp}:5000`);
  }
  console.log('\nNext steps:');
  console.log('1. Restart the backend server so the new environment variables take effect.');
  if (databaseProvider === 'postgresql') {
    console.log(
      '2. Ensure your PostgreSQL instance listens on all interfaces (listen_addresses = \'*\') and pg_hba.conf allows LAN clients.'
    );
  } else {
    console.log(
      '2. Share the selected SQLite file if multiple users need to read it (network storage or synced folder).'
    );
  }
  if (multiUserAccess && lanIp) {
    console.log(
      '3. Share the LAN URL with teammates so they can connect through the common Wi-Fi network.'
    );
  }
};

main().catch((error) => {
  rl.close();
  console.error('System configuration failed:', error);
  process.exit(1);
});
