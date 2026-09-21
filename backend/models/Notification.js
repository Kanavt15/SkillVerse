/**
 * Notification — in-app notifications, also pushed over Socket.io.
 *
 * The MySQL ENUM started as four values and was silently widened by a later
 * migration; the full set is consolidated here, plus the types the new features
 * need (teaching unlock, submissions, challenges).
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const NOTIFICATION_TYPES = [
    // Original schema.sql:207
    'enrollment',
    'new_lesson',
    'certificate',
    'follower',
    // Added by migration_gamification.sql:177
    'badge_earned',
    'level_up',
    'streak_milestone',
    'streak_at_risk',
    // New
    'teaching_unlocked',
    'achievement_unlocked',
    'submission_result',
    'quiz_result',
    'challenge_completed',
    'course_updated',
];

const notificationSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 255 },
    message: { type: String, required: true, maxlength: 2000 },

    // Loosely-typed pointer at whatever the notification is about.
    referenceId: { type: Schema.Types.ObjectId, default: null },
    referenceType: { type: String, default: null },

    isRead: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.TYPES = NOTIFICATION_TYPES;
