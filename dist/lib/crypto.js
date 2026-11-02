import crypto from 'node:crypto';
import { env } from '../config/env.js';
// AES-256-GCM (authenticated encryption). Development falls back to a key derived from JWT_SECRET.
const key = crypto.createHash('sha256').update(env.PAYOUT_ENCRYPTION_KEY ?? env.JWT_SECRET).digest();
/** Encrypts a JSON value to "iv.tag.ciphertext" (base64 parts). */
export const encryptJson = (value) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
};
export const decryptJson = (payload) => {
    const [iv, tag, ciphertext] = payload.split('.').map((part) => Buffer.from(part, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
};
/** "5345346547568576" -> "••••8576"; "jo@mail.com" -> "j•••@mail.com". Safe to show in the UI. */
export const maskValue = (value) => {
    if (value.includes('@')) {
        const [name, domain] = value.split('@');
        return `${name.slice(0, 1)}•••@${domain}`;
    }
    return `••••${value.replace(/\s/g, '').slice(-4)}`;
};
//# sourceMappingURL=crypto.js.map