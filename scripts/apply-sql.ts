// Applies prisma/sql/functions.sql. The file is static and trusted (not user input),
// so $executeRawUnsafe is acceptable here; it is split because Prisma runs one statement per call.
import fs from 'node:fs/promises';
import { prisma } from '../src/config/prisma.js';

const file = new URL('../prisma/sql/functions.sql', import.meta.url);
const statements = (await fs.readFile(file, 'utf8'))
  .split('-- @@split')
  .map((statement) => statement.trim())
  .filter(Boolean);

try {
  for (const statement of statements) await prisma.$executeRawUnsafe(statement);
  console.log(`Applied ${statements.length} SQL statements (stored functions).`);
} finally {
  await prisma.$disconnect();
}
