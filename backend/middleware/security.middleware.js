/**
 * Security Middleware for SkillVerse
 * Provides XSS sanitization, security logging, and content-type validation.
 */

const crypto = require('crypto');

// ============================================================
// XSS Sanitizer — strips HTML tags and common XSS vectors
// ============================================================

/**
 * Recursively sanitize a value by stripping HTML tags and dangerous patterns.
 */
function sanitizeValue(value) {
    if (typeof value === 'string') {
        return value
            // Strip HTML tags
            .replace(/<[^>]*>/g, '')
            // Strip javascript: protocol
            .replace(/javascript\s*:/gi, '')
            // Strip on* event handlers (onerror, onclick, etc.)
            .replace(/\bon\w+\s*=/gi, '')
            // Strip data: protocol in href/src contexts
            .replace(/data\s*:[^,]*,/gi, '')
            // Strip HTML entity encoded scripts
            .replace(/&lt;script/gi, '')
            .replace(/&#/g, '')
            .trim();
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value && typeof value === 'object') {
        return sanitizeObject(value);
    }
    return value;
}

/**
 * Recursively sanitize all values in an object.
 */
function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeValue(value);
    }
    return sanitized;
}

// ============================================================
// NoSQL Operator Stripper — MongoDB injection defense
// ============================================================

/**
 * Recursively remove keys that MongoDB would interpret as query operators.
 *
 * The XSS sanitizer above only ever rewrote VALUES, never keys, so a body of
 * `{"email": {"$gt": ""}}` passed through untouched. Against the MySQL driver
 * that was harmless — parameterized `?` placeholders made it a literal. Against
 * Mongoose it is an authentication bypass: `User.findOne({ email: { $gt: '' } })`
 * matches the first user in the collection.
 *
 * Stripped:
 *   - keys beginning with `$`  ($gt, $ne, $where, $regex, ...)
 *   - keys containing `.`      (dotted paths reach into subdocuments)
 *
 * This runs on EVERY request and is never skippable — unlike the XSS pass,
 * there is no legitimate input that needs a `$`-prefixed key.
 *
 * Mutates in place so it works on Express getters that are not reassignable.
 */
function stripOperatorKeys(obj, req, depth = 0) {
    // Guard against deeply nested payloads crafted to burn CPU.
    if (!obj || typeof obj !== 'object' || depth > 20) return;

    if (Array.isArray(obj)) {
        for (const item of obj) stripOperatorKeys(item, req, depth + 1);
        return;
    }

    for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) {
            delete obj[key];
            if (req && typeof req.logSecurity === 'function') {
                req.logSecurity('SUSPICIOUS', { reason: 'nosql_operator_key', key });
            }
            continue;
        }
        stripOperatorKeys(obj[key], req, depth + 1);
    }
}

/**
 * Route prefixes whose request bodies must NOT have HTML/XSS value sanitization
 * applied, because the body legitimately contains source code.
 *
 * sanitizeValue strips `<` and `>` from every string, which silently corrupts
 * `#include <iostream>`, `vector<int>`, `a < b` and `=>`. Mangling a learner's
 * submission before it reaches the judge produces compile errors they cannot
 * explain and cannot fix.
 *
 * Operator-key stripping still applies to these routes; only the value pass is
 * skipped. Code fields reach the judge as-is and are escaped at render time.
 */
const RAW_BODY_PREFIXES = [
    '/api/submissions',
    '/api/problems/run',
    '/api/quizzes',
];

const skipsValueSanitization = (path) =>
    RAW_BODY_PREFIXES.some((prefix) => path.startsWith(prefix));

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 */
const sanitizeInput = (req, res, next) => {
    // 1. NoSQL injection defense — always, everywhere, no exceptions.
    stripOperatorKeys(req.body, req);
    stripOperatorKeys(req.query, req);
    stripOperatorKeys(req.params, req);

    // 2. XSS value sanitization — skipped for routes carrying source code.
    const skipValues = skipsValueSanitization(req.path || req.originalUrl || '');

    if (!skipValues && req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    // Query and params never carry code, so they are always value-sanitized.
    if (req.query && typeof req.query === 'object') {
        Object.assign(req.query, sanitizeObject(req.query));
    }
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
    }
    next();
};

// ============================================================
// Security Event Logger
// ============================================================

/**
 * Log a structured security event.
 * @param {'AUTH_FAILURE'|'RATE_LIMIT'|'SUSPICIOUS'|'VALIDATION'|'FILE_UPLOAD'} type
 * @param {object} details - Event-specific information
 * @param {object} req - Express request object
 */
function logSecurityEvent(type, details, req) {
    const event = {
        timestamp: new Date().toISOString(),
        type,
        ip: req.ip || req.connection?.remoteAddress || 'unknown',
        method: req.method,
        path: req.originalUrl,
        userAgent: req.headers['user-agent'] || 'unknown',
        userId: req.user?.id || null,
        ...details
    };
    console.warn(`[SECURITY] ${JSON.stringify(event)}`);
}

/**
 * Express middleware that attaches the security logger to the request object.
 */
const securityLogger = (req, res, next) => {
    req.logSecurity = (type, details = {}) => logSecurityEvent(type, details, req);
    next();
};

// ============================================================
// Content-Type Validator
// ============================================================

/**
 * Middleware that rejects non-JSON content types on routes expecting JSON.
 * Skips GET, DELETE, OPTIONS, HEAD, and multipart (file upload) requests.
 */
const validateContentType = (req, res, next) => {
    const skipMethods = ['GET', 'DELETE', 'OPTIONS', 'HEAD'];
    if (skipMethods.includes(req.method)) return next();

    const contentType = req.headers['content-type'] || '';

    // Allow JSON and multipart (file uploads) and URL-encoded
    if (
        contentType.includes('application/json') ||
        contentType.includes('multipart/form-data') ||
        contentType.includes('application/x-www-form-urlencoded') ||
        !contentType // No body may mean no content-type needed
    ) {
        return next();
    }

    return res.status(415).json({
        success: false,
        message: 'Unsupported Content-Type. Use application/json or multipart/form-data.'
    });
};

// ============================================================
// Request ID Generator
// ============================================================

/**
 * Middleware that assigns a unique request ID for tracing.
 */
const requestId = (req, res, next) => {
    const id = crypto.randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-ID', id);
    next();
};

module.exports = {
    sanitizeInput,
    sanitizeObject,
    sanitizeValue,
    stripOperatorKeys,
    securityLogger,
    logSecurityEvent,
    validateContentType,
    requestId
};
