/**
 * XpTransaction — append-only XP ledger.
 *
 * Separate from WalletTransaction on purpose: XP is progression and never
 * decreases or gets spent, while wallet credits are currency. Merging them was
 * the mistake the MySQL schema made in the other direction.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const XP_EVENT_TYPES = [
    'lesson_complete',
    'first_lesson_daily',
    'course_complete',
    'streak_bonus',
    'discussion_post',
    'discussion_helpful',
    'review_posted',
    'milestone_bonus',
    'badge_earned',
    // New
    'problem_solved',
    'quiz_passed',
    'challenge_complete',
];

const xpTransactionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    amount: { type: Number, required: true },
    eventType: { type: String, enum: XP_EVENT_TYPES, required: true, index: true },
    description: { type: String, default: '', maxlength: 255 },

    referenceId: { type: Schema.Types.ObjectId, default: null },
    referenceType: {
        type: String,
        enum: ['lesson', 'course', 'badge', 'discussion', 'review', 'problem', 'quiz', 'challenge', 'streak', null],
        default: null,
    },
}, { timestamps: true });

// Daily XP-cap checks: "how many of event X has this user had today".
xpTransactionSchema.index({ user: 1, eventType: 1, createdAt: -1 });
xpTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('XpTransaction', xpTransactionSchema);
module.exports.EVENT_TYPES = XP_EVENT_TYPES;
