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

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigins, exposedHeaders: ['Content-Disposition'] }));
app.use(compression());
app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.use(express.json({ limit: '20kb' }));
app.use(hpp());
app.use(sanitizeInput);

app.use('/uploads/photos', express.static(path.join(UPLOAD_ROOT, 'photos'), { index: false, maxAge: '7d' }));

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
app.get('/api/v1', (_req, res) => {
  res.json({
    success: true,
    service: 'AbroadMates API',
    version: 'v1',
    examples: {
      health: '/health',
      mentors: '/api/v1/mentors',
      onboardingOptions: '/api/v1/lookups/onboarding-options',
    },
  });
});
app.use('/api/v1', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);
