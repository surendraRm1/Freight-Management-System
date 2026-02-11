const fs = require('fs');
const path = require('path');

const prismaDir = path.resolve(__dirname, '..', 'prisma');
const sourcePath = path.join(prismaDir, 'schema.prisma');
const targetPath = path.join(prismaDir, 'schema.sqlite.prisma');

const source = fs.readFileSync(sourcePath, 'utf8');
const converted = source.replace(/provider\s*=\s*"(postgresql|mysql|sqlserver)"/, 'provider = "sqlite"');

fs.writeFileSync(targetPath, converted, 'utf8');
console.log(`Generated SQLite schema at ${targetPath}`);
