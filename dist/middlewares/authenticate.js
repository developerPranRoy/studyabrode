import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
const readToken = (req) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    return scheme === 'Bearer' && token ? token : null;
};
const attachUser = (req, token) => {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: Number(payload.sub), role: payload.role };
};
/** Requires a valid Bearer token. */
export const authenticate = (req, _res, next) => {
    const token = readToken(req);
    if (!token)
        throw AppError.unauthorized();
    attachUser(req, token);
    next();
};
/** Attaches req.user when a token is present, but never blocks anonymous callers. */
export const optionalAuth = (req, _res, next) => {
    const token = readToken(req);
    if (token)
        attachUser(req, token);
    next();
};
/** Role guard. Must run after `authenticate`. */
export const authorize = (...roles) => (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role))
        throw AppError.forbidden();
    next();
};
//# sourceMappingURL=authenticate.js.map