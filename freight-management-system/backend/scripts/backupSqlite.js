const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const envCandidates = ['.env.desktop', '.env.local', '.env'];
envCandidates.forEach((filename) => {
  const envPath = path.join(rootDir, filename);
  if (fs.existsSync(envPath)) {
    // eslint-disable-next-line global-require
    require('dotenv').config({ path: envPath });
  }
});

const provider = (process.env.DATABASE_PROVIDER || '').toLowerCase();
if (provider !== 'sqlite') {
  console.error('backupSqlite: DATABASE_PROVIDER must be set to sqlite for this script to run.');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL || 'file:./data/freight.db';
if (!databaseUrl.startsWith('file:')) {
  console.error('backupSqlite: DATABASE_URL must use the file: protocol for SQLite.');
  process.exit(1);
}

let dbPath = databaseUrl.replace(/^file:/, '');
if (!path.isAbsolute(dbPath)) {
  dbPath = path.resolve(rootDir, dbPath);
}

if (!fs.existsSync(dbPath)) {
  console.error(`backupSqlite: database file not found at ${dbPath}`);
  process.exit(1);
}

const backupDir = path.join(rootDir, 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `freight-backup-${timestamp}.db`);

fs.copyFileSync(dbPath, backupPath);

console.log(`SQLite backup created at: ${backupPath}`);
