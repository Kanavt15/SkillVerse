/**
 * Authentication controller.
 *
 * Ported from MySQL. Two behavioral changes, both deliberate:
 *
 * 1. Registration no longer accepts a `role`. Every account starts identical
 *    and teaching is earned (spec §4, §34). Previously a user could register
 *    straight into 'instructor', which made the whole progression cosmetic.
 *
 * 2. updateProfile no longer accepts `role` at all. It used to let any user
 *    promote themselves to 'instructor' or 'both' with a single PUT — and
 *    'both' additionally bypassed every authorize() check.
 */

const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const PlatformSettings = require('../models/PlatformSettings');
const Category = require('../models/Category');
const { withTransaction } = require('../config/mongo');
const serialize = require('../serializers');
const {
    generateAccessToken,
    generateRefreshToken,
    validateRefreshToken,
    revokeRefreshToken,
    revokeTokenFamily,
    revokeAllUserTokens,
} = require('../utils/token.utils');
const { getRefreshCookieOptions, getClearCookieOptions } = require('../utils/cookie.utils');

const BCRYPT_ROUNDS = 12;

/**
 * Derive a unique username from an email local-part.
 * Registration accepts an explicit username; this is the fallback.
 */
const deriveUsername = async (email) => {
    let base = String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';

    // The schema requires at least 3 characters, and plenty of real addresses
    // have a shorter local part ("a@", "jd@"). Pad rather than reject: the user
    // did not choose this name and should not see a validation error for it.
    if (base.length < 3) base = `${base}user`;

    let candidate = base.slice(0, 24);
    let suffix = 0;
    /* eslint-disable no-await-in-loop */
    while (await User.exists({ username: candidate })) {
        suffix += 1;
        candidate = `${base.slice(0, 20)}${suffix}`;
    }
    /* eslint-enable no-await-in-loop */
    return candidate;
};

const issueSession = async (req, res, userDoc, statusCode, message) => {
    const accessToken = generateAccessToken(userDoc);
    const { token: refreshToken } = await generateRefreshToken(userDoc._id, null, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
    });

    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

    return res.status(statusCode).json({
        success: true,
        message,
        accessToken,
        user: serialize.user(userDoc),
    });
};

// ------------------------------------------------------------------
// POST /api/auth/register
// ------------------------------------------------------------------
const register = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { email, password, full_name: fullName, username, interests } = req.body;

        // Generic message — a specific "email taken" reply is a user-enumeration
        // oracle against the registration endpoint.
        if (await User.exists({ email })) {
            return res.status(400).json({
                success: false,
                message: 'Registration failed. Please try a different email.',
            });
        }

        const desiredUsername = username
            ? String(username).toLowerCase()
            : await deriveUsername(email);

        if (await User.exists({ username: desiredUsername })) {
            return res.status(400).json({
                success: false,
                message: 'That username is already taken.',
            });
        }

        const settings = await PlatformSettings.getSettings();
        const welcomeBonus = settings.registrationWelcomeBonus;

        const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(BCRYPT_ROUNDS));

        // Only keep interest ids that actually exist, so a bad payload cannot
        // plant dangling references.
        let validInterests = [];
        if (Array.isArray(interests) && interests.length) {
            const ids = interests.filter((i) => mongoose.isValidObjectId(i));
            validInterests = (await Category.find({ _id: { $in: ids } }).select('_id')).map((c) => c._id);
        }

        // The MySQL version was NOT transactional here: it inserted the user,
        // then the welcome-bonus ledger row separately, so a failure between
        // them left a user whose balance had no matching ledger entry.
        const created = await withTransaction(async (session) => {
            const [newUser] = await User.create([{
                fullName,
                username: desiredUsername,
                email,
                password: hashedPassword,
                interests: validInterests,
                wallet: {
                    balance: welcomeBonus,
                    totalEarned: welcomeBonus,
                    totalSpent: 0,
                },
            }], { session });

            await WalletTransaction.create([{
                user: newUser._id,
                type: 'credit',
                amount: welcomeBonus,
                source: 'welcome_bonus',
                balanceAfter: welcomeBonus,
                description: 'Welcome bonus - start your learning journey!',
            }], { session });

            return newUser;
        });

        return await issueSession(req, res, created, 201, 'User registered successfully');
    } catch (error) {
        // Losing a race on the unique index lands here.
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Registration failed. Please try a different email.',
            });
        }
        console.error('Register error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/auth/login
// ------------------------------------------------------------------
const login = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { email, password } = req.body;

        // `password` is select:false on the schema, so ask for it explicitly.
        const user = await User.findOne({ email }).select('+password');

        // Identical response and code path for "no such user" and "wrong
        // password", so neither timing nor message reveals which it was.
        if (!user) {
            if (req.logSecurity) {
                req.logSecurity('AUTH_FAILURE', { reason: 'user_not_found', email });
            }
            // Spend comparable time so a missing user isn't detectably faster.
            await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            if (req.logSecurity) {
                req.logSecurity('AUTH_FAILURE', { reason: 'wrong_password', email });
            }
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.isSuspended) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been suspended.',
                code: 'SUSPENDED',
            });
        }

        return await issueSession(req, res, user, 200, 'Login successful');
    } catch (error) {
        console.error('Login error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/auth/refresh
// ------------------------------------------------------------------
const refresh = async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'No refresh token provided',
                code: 'NO_REFRESH_TOKEN',
            });
        }

        const validation = await validateRefreshToken(refreshToken);

        if (!validation.valid) {
            res.clearCookie('refreshToken', getClearCookieOptions());
            if (req.logSecurity) {
                req.logSecurity('AUTH_FAILURE', {
                    reason: 'invalid_refresh_token',
                    error: validation.error,
                });
            }
            return res.status(401).json({
                success: false,
                message: validation.error,
                code: 'INVALID_REFRESH_TOKEN',
            });
        }

        // Rotate: retire the presented token, mint a replacement in the same
        // family so replay of the old one still trips theft detection.
        await revokeRefreshToken(validation.tokenId);

        const newAccessToken = generateAccessToken(validation.user);
        const { token: newRefreshToken } = await generateRefreshToken(
            validation.userId,
            validation.familyId,
            { userAgent: req.headers['user-agent'], ipAddress: req.ip }
        );

        res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());

        return res.json({ success: true, accessToken: newAccessToken });
    } catch (error) {
        console.error('Refresh error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/auth/logout
// ------------------------------------------------------------------
const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            const validation = await validateRefreshToken(refreshToken);
            if (validation.valid) {
                await revokeTokenFamily(validation.familyId);
            }
        }
        res.clearCookie('refreshToken', getClearCookieOptions());
        return res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        // Clear the cookie regardless — a failed logout must not leave the
        // client believing it is still signed in.
        res.clearCookie('refreshToken', getClearCookieOptions());
        return res.json({ success: true, message: 'Logged out' });
    }
};

// ------------------------------------------------------------------
// POST /api/auth/logout-all
// ------------------------------------------------------------------
const logoutAll = async (req, res, next) => {
    try {
        await revokeAllUserTokens(req.user.id);
        res.clearCookie('refreshToken', getClearCookieOptions());
        return res.json({ success: true, message: 'Logged out from all devices' });
    } catch (error) {
        console.error('Logout all error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/auth/profile
// ------------------------------------------------------------------
const getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).populate('interests', 'name slug icon');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        return res.json({ success: true, user: serialize.user(user) });
    } catch (error) {
        console.error('Get profile error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/auth/profile
// ------------------------------------------------------------------
const updateProfile = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { full_name: fullName, bio, timezone, interests } = req.body;
        const updates = {};

        if (fullName !== undefined) updates.fullName = fullName;
        if (bio !== undefined) updates.bio = bio;
        if (timezone !== undefined) updates.timezone = timezone;

        if (Array.isArray(interests)) {
            const ids = interests.filter((i) => mongoose.isValidObjectId(i));
            const found = await Category.find({ _id: { $in: ids } }).select('_id');
            updates.interests = found.map((c) => c._id);
        }

        // NOTE: `role` is intentionally absent. The MySQL version accepted it
        // here, so any learner could PUT themselves to 'instructor' — or to
        // 'both', which bypassed every authorize() check in the app. Teaching
        // is granted only by the eligibility evaluator now.

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update',
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate('interests', 'name slug icon');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            user: serialize.user(user),
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return next(error);
    }
};

module.exports = {
    register,
    login,
    refresh,
    logout,
    logoutAll,
    getProfile,
    updateProfile,
};
