/**
 * StreakFreeze — a consumed or purchased streak protection.
 *
 * The available count lives on User.streak.freezeCount; this collection is the
 * audit trail of how they were acquired and spent.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const streakFreezeSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // YYYY-MM-DD, in the user's timezone, matching DailyActivity.date.
    freezeDate: { type: String, required: true },

    reason: {
        type: String,
        enum: ['purchased', 'earned', 'bonus', 'consumed'],
        default: 'purchased',
    },
}, { timestamps: true });

streakFreezeSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('StreakFreeze', streakFreezeSchema);
