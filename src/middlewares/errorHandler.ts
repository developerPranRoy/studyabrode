import type { ErrorRequestHandler, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const PRISMA_ERRORS: Record<string, [status: number, message: string]> = {
  P2002: [409, 'Resource already exists'],
  P2003: [409, 'This record is referenced by other records, or references one that does not exist'],
  P2025: [404, 'Record not found'],
  P2034: [409, 'Conflicting request, please retry'],
};

/** Maps library errors to AppError. Returns null for unexpected (programmer) errors. */
const toAppError = (err: unknown): AppError | null => {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return AppError.badRequest(
      'Validation failed',
      err.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && PRISMA_ERRORS[err.code]) {
    const [status, message] = PRISMA_ERRORS[err.code];
    return new AppError(message, status);
  }
  if (err instanceof jwt.TokenExpiredError) return AppError.unauthorized('Token expired');
  if (err instanceof jwt.JsonWebTokenError) return AppError.unauthorized('Invalid token');
  if (err instanceof multer.MulterError) {
    return err.code === 'LIMIT_FILE_SIZE' ? new AppError('File is too large', 413) : AppError.badRequest(err.message);
  }
  const type = (err as { type?: string } | null)?.type; // body-parser errors
  if (type === 'entity.parse.failed') return AppError.badRequest('Malformed JSON body');
  if (type === 'entity.too.large') return new AppError('Request body too large', 413);
  return null;
};

export const notFound: RequestHandler = (req, _res, next) =>
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));

// Express identifies error middleware by its 4-argument signature.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  const known = toAppError(err);
  if (!known || known.statusCode >= 500) console.error(err);

  const error = known ?? new AppError('Internal server error', 500);
  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.code && { code: error.code }),
    ...(error.details ? { errors: error.details } : {}),
    ...(!env.isProd && !known && err instanceof Error ? { stack: err.stack } : {}),
  });
};
