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

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 */
const sanitizeInput = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
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
    securityLogger,
    logSecurityEvent,
    validateContentType,
    requestId
};
