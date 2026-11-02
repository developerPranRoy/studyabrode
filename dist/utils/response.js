/** Uniform success envelope: { success: true, data, meta? } */
export const sendSuccess = (res, data, { status = 200, meta } = {}) => res.status(status).json({ success: true, data, ...(meta && { meta }) });
export const sendNoContent = (res) => res.status(204).send();
//# sourceMappingURL=response.js.map