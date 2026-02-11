const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const BonjourService = require('bonjour-service');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const clientMode = process.env.DESKTOP_CLIENT_MODE === 'true';
const mdnsServiceName = (process.env.MDNS_SERVICE_NAME || 'FreightSystem').toLowerCase();
const mdnsTimeout = Number(process.env.MDNS_DISCOVERY_TIMEOUT || 5000);
const defaultPort = Number(process.env.PORT || 5000);
const DB_POINTER_FILE = 'path.ini';
const DB_CONFIG_FILE = 'config.json';
const TOOLS_DIRNAME = 'tools';
const DB_MANAGER_FILENAME = 'shared_db_manager.exe';
let resolvedApiBase = (process.env.FREIGHT_API_BASE || '').replace(/\/$/, '') || null;

let backendStarted = false;

const setApiBase = (value) => {
  const normalized = (value || '').replace(/\/$/, '');
  if (normalized) {
    resolvedApiBase = normalized;
    process.env.FREIGHT_DESKTOP_API_BASE = normalized;
  }
};

const getDefaultApiBase = () => `http://localhost:${defaultPort}`;

const getToolsRoot = () => {
  if (isDev) {
    return path.join(__dirname, '..', 'python-tools');
  }
  return path.join(process.resourcesPath, TOOLS_DIRNAME);
};

const readStoredDatabasePath = () => {
  try {
    const toolsRoot = getToolsRoot();
    const pointer = path.join(toolsRoot, DB_POINTER_FILE);
    if (fs.existsSync(pointer)) {
      const value = fs.readFileSync(pointer, 'utf8').trim();
      if (value) {
        return value;
      }
    }
    const configPath = path.join(toolsRoot, DB_CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config?.database_file) {
        return config.database_file;
      }
    }
  } catch (error) {
    console.warn('Failed to read stored database path:', error.message);
  }
  return null;
};

const invokeSharedDbManager = () => {
  const toolsRoot = getToolsRoot();
  const options = { encoding: 'utf8' };
  let result;

  if (isDev) {
    const scriptPath = path.join(__dirname, '..', 'python-tools', 'shared_db_manager.py');
    result = spawnSync('python', [scriptPath], options);
  } else {
    const exePath = path.join(toolsRoot, DB_MANAGER_FILENAME);
    result = spawnSync(exePath, [], options);
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Shared DB manager exited with an error.');
  }

  const stdout = (result.stdout || '').trim();
  const jsonLine = stdout
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.trim().startsWith('{') && line.trim().endsWith('}'));
  if (!jsonLine) {
    throw new Error('Shared DB manager did not return JSON output.');
  }
  const parsed = JSON.parse(jsonLine);
  if (!parsed?.database_path) {
    throw new Error('Shared DB manager response missing database_path.');
  }
  return parsed.database_path;
};

const ensureDatabaseFilePath = () => {
  const existing = readStoredDatabasePath();
  if (existing) {
    return existing;
  }
  return invokeSharedDbManager();
};

const startBackend = () => {
  if (backendStarted) return;

  let databaseFilePath;
  try {
    databaseFilePath = ensureDatabaseFilePath();
  } catch (error) {
    dialog.showErrorBox('Database path configuration failed', error.message);
    throw error;
  }

  let serverPath;
  if (isDev) {
    serverPath = path.join(__dirname, '..', 'backend', 'src', 'server.js');
  } else {
    // In production, backend is copied to resources/backend
    serverPath = path.join(process.resourcesPath, 'backend', 'src', 'server.js');
  }

  console.log('Starting backend from:', serverPath);

  try {
    if (!isDev) {
      process.env.NODE_ENV = 'production';
      process.env.PORT = 5000;
      process.env.STORAGE_PROVIDER = 'local';
      process.env.DISABLE_EMAIL_DELIVERY = 'true';
    }

    const normalizedDbUrl = databaseFilePath.startsWith('file:')
      ? databaseFilePath
      : `file:${databaseFilePath.replace(/\\/g, '/')}`;
    process.env.DATABASE_URL = normalizedDbUrl;
    process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
    console.log('Database URL configured:', process.env.DATABASE_URL);

    // eslint-disable-next-line global-require, import/no-dynamic-require
    require(serverPath);
    backendStarted = true;
  } catch (error) {
    dialog.showErrorBox('Backend failed to start', `Path: ${serverPath}\nError: ${error.message}`);
    throw error;
  }
};

const discoverHostService = () =>
  new Promise((resolve) => {
    const BonjourCtor = BonjourService.Bonjour || BonjourService.default || BonjourService;
    const bonjour = new BonjourCtor();
    let settled = false;

    const finalize = (result) => {
      if (settled) return;
      settled = true;
      try {
        browser.stop();
      } catch (error) {
        // ignore
      }
      try {
        bonjour.destroy();
      } catch (error) {
        // ignore
      }
      resolve(result);
    };

    const browser = bonjour.find({ type: 'http' }, (service) => {
      if (!service || settled) return;
      const name = (service.name || '').toLowerCase();
      if (!name.includes(mdnsServiceName)) return;
      const hostCandidate =
        service.txt?.ip ||
        service.host ||
        service.referer?.address ||
        (Array.isArray(service.addresses) ? service.addresses[0] : null);
      if (!hostCandidate) return;
      finalize({
        host: hostCandidate,
        port: service.port || defaultPort,
      });
    });

    setTimeout(() => finalize(null), mdnsTimeout).unref?.();
  });

const ensureBackendOrHost = async () => {
  if (!clientMode) {
    startBackend();
    setApiBase(getDefaultApiBase());
    return;
  }

  if (resolvedApiBase) {
    setApiBase(resolvedApiBase);
    return;
  }

  const result = await discoverHostService();
  if (result?.host) {
    const base = `http://${result.host}:${result.port || defaultPort}`;
    setApiBase(base);
    return;
  }

  // fallback to local host (may fail if backend absent, but keeps UI functional)
  setApiBase(getDefaultApiBase());
};

const resolveFrontendEntry = () => {
  if (isDev) {
    return { type: 'url', value: 'http://localhost:5173' };
  }

  // In production, frontend is at resources/frontend/index.html
  const frontendPath = path.join(process.resourcesPath, 'frontend', 'index.html');
  return { type: 'file', value: frontendPath };
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Freight Management Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const entry = resolveFrontendEntry();
  if (entry.type === 'url') {
    win.loadURL(entry.value);
  } else {
    win.loadFile(entry.value);
  }

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
};

ipcMain.handle('freight:get-api-base', () => resolvedApiBase || getDefaultApiBase());

app.whenReady().then(async () => {
  await ensureBackendOrHost();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
