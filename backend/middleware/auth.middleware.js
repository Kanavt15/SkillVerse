/**
 * Authentication and authorization.
 *
 * SECURITY CHANGE FROM THE MySQL VERSION:
 *
 * `authorize(...roles)` used to read:
 *
 *     if (!roles.includes(req.user.role) && req.user.role !== 'both') { 403 }
 *
 * making `role === 'both'` a pass for EVERY check — including a future
 * `authorize('admin')`. Since roughly any user could set their own role to
 * 'both' through PUT /api/auth/profile, that was a self-serve path to any
 * privilege the app would ever add. The role enum is now 'user' | 'admin'
 * only, and teaching is a capability rather than a role, so no bypass value
 * exists.
 *
 * Teaching is ALWAYS verified against the database, never from the JWT: the
 * requirements are admin-configurable and eligibility can be revoked, so a
 * token minted minutes earlier is not evidence of anything.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_VERIFY_OPTIONS = {
    issuer: 'skillverse',
    audience: 'skillverse-client',
};

/** Verify the bearer token and attach the claims to req.user. */
const auth = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No authentication token, access denied',
                code: 'NO_TOKEN',
            });
        }

        const token = authHeader.slice(7);
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No authentication token, access denied',
                code: 'NO_TOKEN',
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET, JWT_VERIFY_OPTIONS);

        // Clock-skew guard: reject tokens claiming to be from the future.
        if (decoded.iat && decoded.iat > Math.floor(Date.now() / 1000) + 60) {
            if (req.logSecurity) {
                req.logSecurity('AUTH_FAILURE', { reason: 'future_token', userId: decoded.id });
            }
            return res.status(401).json({
                success: false,
                message: 'Token is invalid',
                code: 'INVALID_TOKEN',
            });
        }

        req.user = decoded;
        return next();
    } catch (error) {
        if (req.logSecurity) {
            req.logSecurity('AUTH_FAILURE', {
                reason: error.name === 'TokenExpiredError' ? 'token_expired' : 'invalid_token',
                errorName: error.name,
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Access token expired',
                code: 'TOKEN_EXPIRED',
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Token is invalid or expired',
            code: 'INVALID_TOKEN',
        });
    }
};

/**
 * Load the full user document onto req.currentUser.
 * Also rejects suspended accounts, which the JWT alone cannot express.
 */
const loadUser = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'NO_TOKEN',
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists',
                code: 'INVALID_TOKEN',
            });
        }
        if (user.isSuspended) {
            if (req.logSecurity) {
                req.logSecurity('AUTH_FAILURE', { reason: 'suspended', userId: user.id });
            }
            return res.status(403).json({
                success: false,
                message: 'Your account has been suspended.',
                code: 'SUSPENDED',
            });
        }

        req.currentUser = user;
        return next();
    } catch (err) {
        return next(err);
    }
};

/**
 * Restrict to specific account roles ('user' | 'admin').
 * No value passes every check any more.
 */
const authorize = (...roles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            code: 'NO_TOKEN',
        });
    }

    if (!roles.includes(req.user.role)) {
        if (req.logSecurity) {
            req.logSecurity('AUTH_FAILURE', {
                reason: 'insufficient_role',
                required: roles,
                actual: req.user.role,
            });
        }
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to perform this action',
        });
    }

    return next();
};

/** Admin-only. */
const isAdmin = [auth, authorize('admin')];

/**
 * Gate teaching actions on earned eligibility, checked against the database.
 *
 * Admins pass unconditionally so the platform stays administrable. Everyone
 * else must have actually unlocked teaching. Phase E adds live re-evaluation
 * against PlatformSettings; this is the enforcement point either way, and the
 * frontend hiding a button is never sufficient.
 */
const requireTeaching = async (req, res, next) => {
    try {
        if (!req.currentUser) {
            return loadUser(req, res, () => requireTeaching(req, res, next));
        }

        const user = req.currentUser;
        if (user.role === 'admin' || user.teaching?.isEligible) {
            return next();
        }

        if (req.logSecurity) {
            req.logSecurity('AUTH_FAILURE', { reason: 'teaching_locked', userId: user.id });
        }

        return res.status(403).json({
            success: false,
            message: 'Teaching is locked. Continue learning to unlock teaching.',
            code: 'TEACHING_LOCKED',
        });
    } catch (err) {
        return next(err);
    }
};

/**
 * Every authenticated account is a learner, so this only asserts authentication.
 * Kept so existing route definitions keep reading sensibly.
 */
const isLearner = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            code: 'NO_TOKEN',
        });
    }
    return next();
};

module.exports = {
    auth,
    loadUser,
    authorize,
    isAdmin,
    requireTeaching,
    isLearner,
    // Legacy alias. Routes still say `isInstructor`; it now means "has earned
    // the right to teach" rather than "picked instructor at signup".
    isInstructor: requireTeaching,
};
