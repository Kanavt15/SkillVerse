/**
 * RefreshToken — opaque rotating refresh tokens with family theft detection.
 *
 * Only the SHA-256 hash is stored; the token itself is never persisted. If an
 * already-rotated token is replayed, the whole family is revoked.
 *
 * The MySQL table grew a row per refresh (every 15 minutes per active session)
 * and was pruned only by a 3 AM cron. A TTL index does that continuously, so
 * the cron job is deleted rather than ported.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const refreshTokenSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    tokenHash: { type: String, required: true, unique: true, maxlength: 64 },
    familyId: { type: String, required: true, index: true },

    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: null },

    userAgent: { type: String, default: null, maxlength: 500 },
    ipAddress: { type: String, default: null, maxlength: 45 },
}, { timestamps: true });

// Active-token lookup for a user.
refreshTokenSchema.index({ user: 1, isRevoked: 1, expiresAt: 1 });

// Continuous cleanup. Mongo removes the document once expiresAt passes.
// Revoked-but-unexpired rows stay until their natural expiry, which is what
// keeps replay detection working for the life of the token.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
