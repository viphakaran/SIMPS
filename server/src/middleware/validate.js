import { BadRequestError } from '../utils/errors.js';

/**
 * Validates request body, query, and/or params against Zod schemas.
 * @param {object} schemas - { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 */
export function validate(schemas = {}) {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err.errors && Array.isArray(err.errors)) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return next(new BadRequestError('Validation failed', 'VALIDATION_ERROR', details));
      }
      next(err);
    }
  };
}
