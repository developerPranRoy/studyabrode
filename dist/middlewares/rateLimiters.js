import rateLimit from 'express-rate-limit';
const limiter = (limit, message) => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message },
});
export const apiLimiter = limiter(300, 'Too many requests, please try again later');
export const authLimiter = limiter(20, 'Too many authentication attempts, please try again later');
//# sourceMappingURL=rateLimiters.js.map