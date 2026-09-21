/**
 * Access + refresh token handling.
 *
 * Scheme is unchanged from the MySQL implementation, which was sound:
 *   - short-lived JWT access token (15m), returned in the response body
 *   - opaque random refresh token, only its SHA-256 hash is stored
 *   - rotation on every use, with family-based theft detection
 *
 * What changed:
 *   - storage is now the RefreshToken collection
 *   - expired rows are reaped by a TTL index rather than a nightly cron
 *   - `role` in the JWT is only 'user' | 'admin'. Teaching is NOT a role and is
 *     never carried in the token: it is admin-configurable and can be revoked,
 *     and a token minted before a change would otherwise stay valid for 15
 *     minutes. Teaching is always re-checked against the database.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 10) || 7;

const JWT_OPTIONS = {
    issuer: 'skillverse',
    audience: 'skillverse-client',
};

/** 32 random bytes as hex. Never stored — only its hash is. */
function generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Mint a short-lived access token.
 * @param {{_id?: any, id?: any, email: string, role: string}} user
 */
function generateAccessToken(user) {
    return jwt.sign(
        {
            id: String(user._id || user.id),
            email: user.email,
            role: user.role || 'user',
        },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY, ...JWT_OPTIONS }
    );
}

/**
 * Issue a refresh token, storing only its hash.
 * @param {string} userId
 * @param {string|null} familyId - existing family when rotating, null for a new chain
 * @param {{userAgent?: string, ipAddress?: string}} metadata
 */
async function generateRefreshToken(userId, familyId = null, metadata = {}) {
    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const newFamilyId = familyId || crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
        user: userId,
        tokenHash,
        familyId: newFamilyId,
        expiresAt,
        userAgent: metadata.userAgent || null,
        ipAddress: metadata.ipAddress || null,
    });

    return { token, familyId: newFamilyId };
}

/**
 * Validate a presented refresh token.
 *
 * Replaying an already-rotated token means it leaked: the legitimate client
 * would have received a new one. So a revoked-token hit revokes the entire
 * family, logging out the attacker and the victim alike.
 */
async function validateRefreshToken(token) {
    const tokenHash = hashToken(token);

    const record = await RefreshToken.findOne({ tokenHash }).populate('user', 'email role isSuspended');

    if (!record) {
        return { valid: false, error: 'Token not found' };
    }

    if (record.isRevoked) {
        await revokeTokenFamily(record.familyId);
        return { valid: false, error: 'Token reuse detected - all sessions revoked' };
    }

    if (record.expiresAt < new Date()) {
        return { valid: false, error: 'Token expired' };
    }

    // The user may have been deleted or suspended since the token was issued.
    if (!record.user) {
        await revokeTokenFamily(record.familyId);
        return { valid: false, error: 'User no longer exists' };
    }
    if (record.user.isSuspended) {
        await revokeAllUserTokens(record.user._id);
        return { valid: false, error: 'Account suspended' };
    }

    return {
        valid: true,
        userId: String(record.user._id),
        familyId: record.familyId,
        user: {
            id: String(record.user._id),
            email: record.user.email,
            role: record.user.role,
        },
        tokenId: String(record._id),
    };
}

/** Mark one token as used, as part of rotation. */
async function revokeRefreshToken(tokenId) {
    await RefreshToken.updateOne(
        { _id: tokenId },
        { $set: { isRevoked: true, lastUsedAt: new Date() } }
    );
}

/** Revoke a whole chain — logout, or theft detection. */
async function revokeTokenFamily(familyId) {
    await RefreshToken.updateMany({ familyId }, { $set: { isRevoked: true } });
}

/** Revoke every session for a user. */
async function revokeAllUserTokens(userId) {
    await RefreshToken.updateMany({ user: userId }, { $set: { isRevoked: true } });
}

/**
 * Retained only so the cron module keeps a callable export. The TTL index on
 * `expiresAt` does this continuously now, so there is nothing left to sweep.
 */
async function cleanupExpiredTokens() {
    const result = await RefreshToken.deleteMany({ expiresAt: { $lt: new Date() } });
    return result.deletedCount;
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    validateRefreshToken,
    revokeRefreshToken,
    revokeTokenFamily,
    revokeAllUserTokens,
    cleanupExpiredTokens,
    hashToken,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY_DAYS,
};
