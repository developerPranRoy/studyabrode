import type { Response } from 'express';

interface Options {
  status?: number;
  meta?: Record<string, unknown>;
}

/** Uniform success envelope: { success: true, data, meta? } */
export const sendSuccess = (res: Response, data: unknown, { status = 200, meta }: Options = {}) =>
  res.status(status).json({ success: true, data, ...(meta && { meta }) });

export const sendNoContent = (res: Response) => res.status(204).send();
