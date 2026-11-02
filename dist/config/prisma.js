import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
// Single shared client (connection pool) for the whole process.
export const prisma = new PrismaClient({ log: env.isProd ? ['error'] : ['warn', 'error'] });
//# sourceMappingURL=prisma.js.map