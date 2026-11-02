import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Higher-order function: forwards rejected promises of async handlers to the
 * global error handler, so controllers need no try/catch.
 */
export const catchAsync =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
