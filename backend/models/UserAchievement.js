/**
 * UserAchievement — the join between a user and an earned Achievement.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const userAchievementSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    achievement: { type: Schema.Types.ObjectId, ref: 'Achievement', required: true, index: true },

    earnedAt: { type: Date, default: Date.now },
    // At most one featured badge per user, enforced in the service by clearing
    // the others inside the same transaction.
    isFeatured: { type: Boolean, default: false },
}, { timestamps: true });

// Replaces `unique_user_badge (user_id, badge_id)`. This is what makes badge
// awarding idempotent — re-running the evaluator cannot double-award.
userAchievementSchema.index({ user: 1, achievement: 1 }, { unique: true });
userAchievementSchema.index({ user: 1, earnedAt: -1 });

module.exports = mongoose.model('UserAchievement', userAchievementSchema);
