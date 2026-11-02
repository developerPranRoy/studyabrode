import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies the Cloudflare Turnstile token sent as `captchaToken`.
 * Skipped when TURNSTILE_SECRET_KEY is not configured (development only; required in production).
 */
export const verifyCaptcha = catchAsync(async (req, _res, next) => {
  if (!env.TURNSTILE_SECRET_KEY) return next();

  const token: unknown = req.body?.captchaToken;
  if (typeof token !== 'string' || !token) throw AppError.badRequest('Captcha verification is required');

  const response = await fetch(VERIFY_URL, {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: req.ip ?? '' }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    throw new AppError('Captcha service is unavailable', 502);
  });
  const result = (await response.json()) as { success?: boolean };
  if (!result.success) throw AppError.badRequest('Captcha verification failed');
  next();
});
