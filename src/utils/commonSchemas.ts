import type { Request } from 'express';
import { z } from 'zod';

const MAX_INT4 = 2_147_483_647; // PostgreSQL `integer` upper bound

/** Positive PostgreSQL-safe integer id (body use). */
export const idSchema = z.number().int().positive().max(MAX_INT4);

/** Same, coerced from a string (path / query use). */
export const idParam = z.coerce.number().pipe(idSchema);

export const idParams = { params: z.object({ id: idParam }) };

export const slugSchema = z.string().regex(/^[a-z0-9-]{1,80}$/, 'Invalid slug');

export const slugParams = { params: z.object({ slug: slugSchema }) };

/** Treats an empty query-string value ("?search=") as "not provided". */
export const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/** `req.params.id` after `validate(idParams)` has coerced it. */
export const paramId = (req: Request, name = 'id'): number => Number(req.params[name]);

/** Validates an IANA time-zone name (e.g. "Asia/Dhaka") against the runtime's tz database. */
export const timezoneSchema = z.string().max(64).refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown time zone');
