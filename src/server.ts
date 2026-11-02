import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

await prisma.$connect(); // fail fast if the database is unreachable

const server = app.listen(env.PORT, () => {
  console.log(`AbroadMates API listening on :${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = (reason: string, exitCode = 0) => {
  console.log(`Shutting down (${reason})`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(exitCode);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // force-exit if connections hang
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown('uncaughtException', 1);
});
