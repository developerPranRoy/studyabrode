import 'dotenv/config';
import { z } from 'zod';

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  APP_URL: z.string().trim().url().optional().or(z.literal('')),
  UPLOAD_DIR: z.string().default('uploads'),
  UNIVERSITY_API_URL: z.string().url().default('http://universities.hipolabs.com/search'),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  MAIL_FROM: z.string().default('AbroadMates <team@abroadmates.com>'),
  TURNSTILE_SECRET_KEY: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  PAYOUT_ENCRYPTION_KEY: optionalString,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const isProd = parsed.data.NODE_ENV === 'production';
if (isProd && (!parsed.data.SMTP_HOST || !parsed.data.TURNSTILE_SECRET_KEY)) {
  console.error('SMTP_HOST and TURNSTILE_SECRET_KEY are required in production');
  process.exit(1);
}

const corsOrigins = parsed.data.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const appUrl = parsed.data.APP_URL || corsOrigins[0] || 'http://localhost:3000';

export const env = {
  ...parsed.data,
  APP_URL: appUrl,
  isProd,
  corsOrigins,
};
