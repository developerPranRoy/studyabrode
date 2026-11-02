/** Operational error: safe to show to the client. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly details?: unknown,
    /** Stable machine-readable code the client can branch on (e.g. EMAIL_NOT_VERIFIED). */
    public readonly code?: string,
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest = (message: string, details?: unknown) => new AppError(message, 400, details);
  static unauthorized = (message = 'Authentication required') => new AppError(message, 401);
  static forbidden = (message = 'You do not have permission to do this', code?: string) =>
    new AppError(message, 403, undefined, code);
  static notFound = (message = 'Resource not found') => new AppError(message, 404);
  static conflict = (message: string) => new AppError(message, 409);
}
