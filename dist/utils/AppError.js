/** Operational error: safe to show to the client. Anything else becomes a generic 500. */
export class AppError extends Error {
    statusCode;
    details;
    code;
    constructor(message, statusCode = 500, details, 
    /** Stable machine-readable code the client can branch on (e.g. EMAIL_NOT_VERIFIED). */
    code) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
    static badRequest = (message, details) => new AppError(message, 400, details);
    static unauthorized = (message = 'Authentication required') => new AppError(message, 401);
    static forbidden = (message = 'You do not have permission to do this', code) => new AppError(message, 403, undefined, code);
    static notFound = (message = 'Resource not found') => new AppError(message, 404);
    static conflict = (message) => new AppError(message, 409);
}
//# sourceMappingURL=AppError.js.map