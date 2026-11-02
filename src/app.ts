import path from 'node:path';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimiters.js';
import { sanitizeInput } from './middlewares/sanitize.js';
import { UPLOAD_ROOT } from './middlewares/upload.js';
import routes from './routes.js';
import { catchAsync } from './utils/catchAsync.js';

export const app = express();

// --- Security & transport ---------------------------------------------------
// CORP "cross-origin" lets the Next.js client (another origin) render uploaded photos.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigins, exposedHeaders: ['Content-Disposition'] }));
app.use(compression());
app.use(morgan(env.isProd ? 'combined' : 'dev'));

// --- Parsing & input hygiene ------------------------------------------------
app.use(express.json({ limit: '20kb' }));
app.use(hpp()); // HTTP parameter pollution
app.use(sanitizeInput); // strips HTML from all user text

// --- Static files: only profile photos are public; CVs go through an authenticated route
app.use('/uploads/photos', express.static(path.join(UPLOAD_ROOT, 'photos'), { index: false, maxAge: '7d' }));

// --- Routes -----------------------------------------------------------------
// Friendly landing response: every API route lives under /api/v1.
app.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'AbroadMates API',
    health: '/health',
    api: '/api/v1',
  });
});
app.get(
  '/health',
  catchAsync(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, status: 'ok', uptime: process.uptime() });
  }),
);
app.use('/api/v1', apiLimiter, routes);

// --- Errors (must be last) --------------------------------------------------
app.use(notFound);
app.use(errorHandler);
