import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
export const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR);
// Allow-list per upload kind. The client-declared MIME type alone can be spoofed,
// so the file's magic bytes are verified as well.
const KINDS = {
    photo: {
        dir: 'photos',
        maxBytes: 2 * 1024 * 1024,
        types: {
            'image/jpeg': { ext: '.jpg', magic: [0xff, 0xd8, 0xff] },
            'image/png': { ext: '.png', magic: [0x89, 0x50, 0x4e, 0x47] },
        },
    },
    cv: {
        dir: 'cvs',
        maxBytes: 5 * 1024 * 1024,
        types: { 'application/pdf': { ext: '.pdf', magic: [0x25, 0x50, 0x44, 0x46] } },
    },
};
/**
 * Returns [multerParser, saveToDisk]. The saved file gets a random server-side
 * name (no user-controlled path), and its relative path is set on req.uploadedPath.
 */
export const uploadFile = (kind) => {
    const { dir, maxBytes, types } = KINDS[kind];
    const parser = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxBytes, files: 1 },
        fileFilter: (_req, file, cb) => {
            if (types[file.mimetype])
                cb(null, true);
            else
                cb(AppError.badRequest(`Allowed file types: ${Object.keys(types).join(', ')}`));
        },
    }).single('file');
    const save = catchAsync(async (req, _res, next) => {
        if (!req.file)
            throw AppError.badRequest('A "file" field is required');
        const { ext, magic } = types[req.file.mimetype];
        if (!magic.every((byte, index) => req.file?.buffer[index] === byte)) {
            throw AppError.badRequest('File content does not match its declared type');
        }
        const relativePath = path.posix.join(dir, `${crypto.randomUUID()}${ext}`);
        await fs.mkdir(path.join(UPLOAD_ROOT, dir), { recursive: true });
        await fs.writeFile(path.join(UPLOAD_ROOT, relativePath), req.file.buffer);
        req.uploadedPath = relativePath;
        next();
    });
    return [parser, save];
};
/** Deletes a previously stored file (paths come from the DB, never from the client). */
export const removeUpload = (relativePath) => relativePath ? fs.rm(path.join(UPLOAD_ROOT, relativePath), { force: true }) : Promise.resolve();
/** Public URL of a stored photo. */
export const fileUrl = (relativePath) => relativePath ? `/uploads/${relativePath}` : null;
//# sourceMappingURL=upload.js.map