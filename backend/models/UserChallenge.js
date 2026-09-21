/**
 * UserChallenge — a learner's progress against a Challenge.
 *
 * The spec requires that a challenge reward cannot be claimed twice. The unique
 * (user, challenge) index makes duplicate rows impossible, and `rewardedAt`
 * being set is the claim itself — so the guard is a conditional update
 * (`rewardedAt: null` in the filter) rather than a read-then-write that two
 * concurrent requests could both pass.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const userChallengeSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    challenge: { type: Schema.Types.ObjectId, ref: 'Challenge', required: true, index: true },

    progress: { type: Number, default: 0, min: 0 },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },

    // Non-null means the XP has been granted. Never grant twice.
    rewardedAt: { type: Date, default: null },
    xpAwarded: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

userChallengeSchema.index({ user: 1, challenge: 1 }, { unique: true });

module.exports = mongoose.model('UserChallenge', userChallengeSchema);
