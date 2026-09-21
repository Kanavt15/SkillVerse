/**
 * ActivityAuditLog — anti-cheat trail.
 *
 * MySQL stored `metadata` as a JSON column and queried it with
 * JSON_EXTRACT(metadata, '$.timeSpent'). Here those are real, indexable fields,
 * which makes the suspicious-activity detection both simpler and faster.
 *
 * Pruned by a TTL index rather than the weekly cron DELETE it used before.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const activityAuditLogSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    actionType: { type: String, required: true, maxlength: 50 },
    entityType: { type: String, default: null, maxlength: 50 },
    entityId: { type: Schema.Types.ObjectId, default: null },

    ipAddress: { type: String, default: null, maxlength: 45 },
    userAgent: { type: String, default: null },

    // Promoted out of the JSON blob so the detectors can index on it.
    timeSpentSeconds: { type: Number, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },

    isSuspicious: { type: Boolean, default: false, index: true },
}, { timestamps: true });

activityAuditLogSchema.index({ user: 1, actionType: 1, createdAt: -1 });
activityAuditLogSchema.index({ entityType: 1, entityId: 1 });

// Replaces cleanupOldAuditLogs. 90 days covers the longest detection window
// (the suspicious-pattern report looks back 7 days) with wide margin.
activityAuditLogSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

module.exports = mongoose.model('ActivityAuditLog', activityAuditLogSchema);
