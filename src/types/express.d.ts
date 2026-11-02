import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` / `optionalAuth`. */
      user?: { id: number; role: Role };
      /** Relative path of a file stored by `uploadFile`. */
      uploadedPath?: string;
    }
  }
}

export {};
