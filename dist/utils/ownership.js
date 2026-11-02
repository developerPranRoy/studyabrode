import { AppError } from './AppError.js';
/** Throws 404 when the record is missing and 403 when `record[ownerKey]` is not the caller. */
export const assertOwner = (record, ownerKey, userId, label) => {
    if (!record)
        throw AppError.notFound(`${label} not found`);
    if (record[ownerKey] !== userId)
        throw AppError.forbidden(`You can only modify your own ${label.toLowerCase()}`);
    return record;
};
//# sourceMappingURL=ownership.js.map