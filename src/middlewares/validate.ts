import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

type Schemas = Partial<Record<'params' | 'query' | 'body', ZodTypeAny>>;

/**
 * Validates and replaces req.params / req.query / req.body with the parsed
 * (coerced, defaulted, unknown-keys-stripped) values. ZodError is handled globally.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (schema) req[key] = schema.parse(req[key]);
    }
    next();
  };
