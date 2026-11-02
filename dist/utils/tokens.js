import crypto from 'node:crypto';
/** Random URL-safe token to e-mail to the user. */
export const generateToken = () => crypto.randomBytes(32).toString('hex');
/** Only this hash is stored, so a database leak cannot be used to verify accounts or reset passwords. */
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
//# sourceMappingURL=tokens.js.map