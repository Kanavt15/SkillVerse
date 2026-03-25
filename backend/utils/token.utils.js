const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');

// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 10) || 7;

const JWT_OPTIONS = {
  issuer: 'skillverse',
  audience: 'skillverse-client'
};

/**
 * Generate a cryptographically secure random token (32 bytes = 64 hex chars)
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate an access token (short-lived JWT)
 * @param {object} user - User object with id, email, role
 * @returns {string} JWT access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY, ...JWT_OPTIONS }
  );
}

/**
 * Generate a refresh token and store its hash in the database
 * @param {number} userId - User ID
 * @param {string|null} familyId - Existing family ID (for rotation) or null for new chain
 * @param {object} metadata - { userAgent, ipAddress }
 * @returns {Promise<{token: string, familyId: string}>}
 */
async function generateRefreshToken(userId, familyId = null, metadata = {}) {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const newFamilyId = familyId || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens
     (user_id, token_hash, family_id, expires_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, tokenHash, newFamilyId, expiresAt, metadata.userAgent || null, metadata.ipAddress || null]
  );

  return { token, familyId: newFamilyId };
}

/**
 * Validate a refresh token
 * @param {string} token - Raw refresh token
 * @returns {Promise<{valid: boolean, userId?: number, familyId?: string, user?: object, tokenId?: number, error?: string}>}
 */
async function validateRefreshToken(token) {
  const tokenHash = hashToken(token);

  const [rows] = await pool.query(
    `SELECT rt.id, rt.user_id, rt.family_id, rt.is_revoked, rt.expires_at,
            u.email, u.role
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = ?`,
    [tokenHash]
  );

  if (rows.length === 0) {
    return { valid: false, error: 'Token not found' };
  }

  const tokenRecord = rows[0];

  // Check if token was revoked (potential replay attack)
  if (tokenRecord.is_revoked) {
    // SECURITY: Revoke all tokens in this family (theft detection)
    await revokeTokenFamily(tokenRecord.family_id);
    return { valid: false, error: 'Token reuse detected - all sessions revoked' };
  }

  // Check expiry
  if (new Date(tokenRecord.expires_at) < new Date()) {
    return { valid: false, error: 'Token expired' };
  }

  return {
    valid: true,
    userId: tokenRecord.user_id,
    familyId: tokenRecord.family_id,
    user: { id: tokenRecord.user_id, email: tokenRecord.email, role: tokenRecord.role },
    tokenId: tokenRecord.id
  };
}

/**
 * Revoke a specific refresh token (mark as used for rotation)
 * @param {number} tokenId - Token ID from database
 */
async function revokeRefreshToken(tokenId) {
  await pool.query(
    'UPDATE refresh_tokens SET is_revoked = 1, last_used_at = NOW() WHERE id = ?',
    [tokenId]
  );
}

/**
 * Revoke all tokens in a family (for logout or theft detection)
 * @param {string} familyId - Token family UUID
 */
async function revokeTokenFamily(familyId) {
  await pool.query(
    'UPDATE refresh_tokens SET is_revoked = 1 WHERE family_id = ?',
    [familyId]
  );
}

/**
 * Revoke all tokens for a user (logout from all devices)
 * @param {number} userId - User ID
 */
async function revokeAllUserTokens(userId) {
  await pool.query(
    'UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?',
    [userId]
  );
}

/**
 * Clean up expired tokens (run periodically via cron)
 * @returns {Promise<number>} Number of deleted rows
 */
async function cleanupExpiredTokens() {
  const [result] = await pool.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < NOW()
        OR (is_revoked = 1 AND last_used_at < DATE_SUB(NOW(), INTERVAL 30 DAY))`
  );
  return result.affectedRows;
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
  REFRESH_TOKEN_EXPIRY_DAYS
};
