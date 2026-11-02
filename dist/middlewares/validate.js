/**
 * Validates and replaces req.params / req.query / req.body with the parsed
 * (coerced, defaulted, unknown-keys-stripped) values. ZodError is handled globally.
 */
export const validate = (schemas) => (req, _res, next) => {
    for (const key of ['params', 'query', 'body']) {
        const schema = schemas[key];
        if (schema)
            req[key] = schema.parse(req[key]);
    }
    next();
};
//# sourceMappingURL=validate.js.map