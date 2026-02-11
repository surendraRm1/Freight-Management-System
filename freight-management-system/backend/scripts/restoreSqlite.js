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
  console.error('restoreSqlite: DATABASE_PROVIDER must be set to sqlite before restoring.');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL || 'file:./data/freight.db';
if (!databaseUrl.startsWith('file:')) {
  console.error('restoreSqlite: DATABASE_URL must use the file: protocol for SQLite.');
  process.exit(1);
}

let dbPath = databaseUrl.replace(/^file:/, '');
if (!path.isAbsolute(dbPath)) {
  dbPath = path.resolve(rootDir, dbPath);
}

const backupArg = process.argv[2];
if (!backupArg) {
  console.error('restoreSqlite: provide a backup file path, e.g. npm run restore:sqlite ./backups/freight-backup-2026-02-05.db');
  process.exit(1);
}

const backupPath = path.resolve(rootDir, backupArg);
if (!fs.existsSync(backupPath)) {
  console.error(`restoreSqlite: backup file not found at ${backupPath}`);
  process.exit(1);
}

const existingDbExists = fs.existsSync(dbPath);
if (existingDbExists) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archivePath = `${dbPath}.archive-${timestamp}`;
  fs.copyFileSync(dbPath, archivePath);
  console.log(`Existing DB archived to ${archivePath}`);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.copyFileSync(backupPath, dbPath);

console.log(`SQLite database restored from ${backupPath} to ${dbPath}`);
