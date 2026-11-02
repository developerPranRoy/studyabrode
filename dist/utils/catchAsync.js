/**
 * Higher-order function: forwards rejected promises of async handlers to the
 * global error handler, so controllers need no try/catch.
 */
export const catchAsync = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};
//# sourceMappingURL=catchAsync.js.map