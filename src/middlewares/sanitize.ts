
import type { RequestHandler } from 'express';
import xss from 'xss';

// Strip every HTML tag; <script>/<style> bodies are removed entirely.
const filter = (value: string): string =>
  xss(value, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  });

const UNTOUCHED_KEYS = new Set([
  'password',
  'confirmPassword',
  'idToken',
  'captchaToken',
  'token',
]);

const clean = (value: unknown, key?: string): unknown => {
  if (typeof value === 'string') {
    return key && UNTOUCHED_KEYS.has(key)
      ? value
      : filter(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => clean(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, clean(v, k)])
    );
  }

  return value;
};

/**
 * Defence in depth against stored XSS:
 * user-supplied text is stripped of HTML on the way in.
 */
export const sanitizeInput: RequestHandler = (req, _res, next) => {
  req.body = clean(req.body);
  req.query = clean(req.query) as typeof req.query;
  next();
};
