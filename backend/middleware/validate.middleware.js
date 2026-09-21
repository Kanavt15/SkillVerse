/**
 * Shared request-validation helpers.
 *
 * Every route module previously defined its own inline `validate` function and
 * its own `isInt({min:1})` id checks. Integer ids are gone, so the id checks
 * all have to change anyway — centralizing them here means the ObjectId rule
 * is written once rather than seventeen times.
 */

const { validationResult, param, query } = require('express-validator');
const mongoose = require('mongoose');

/** Terminate the chain with a 400 if any validator failed. */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.logSecurity) {
            req.logSecurity('VALIDATION', { errors: errors.array().map((e) => e.path) });
        }
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    return next();
};

/** Assert that a route parameter is a well-formed ObjectId. */
const objectIdParam = (name = 'id') => param(name)
    .custom((value) => mongoose.isValidObjectId(value))
    .withMessage(`Valid ${name} is required`);

/** Same, for an optional query-string id. */
const objectIdQuery = (name) => query(name)
    .optional()
    .custom((value) => mongoose.isValidObjectId(value))
    .withMessage(`Invalid ${name}`);

/** Standard page/limit validators. `limit` is capped to bound query cost. */
const paginationQuery = (maxLimit = 100) => [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: maxLimit }).toInt(),
];

/** Normalize pagination into a skip/limit pair. */
const getPagination = (req, defaultLimit = 12, maxLimit = 100) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), maxLimit);
    return { page, limit, skip: (page - 1) * limit };
};

module.exports = {
    validate,
    objectIdParam,
    objectIdQuery,
    paginationQuery,
    getPagination,
};
