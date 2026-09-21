/**
 * Challenge — a daily (or dated) goal, e.g. "solve 2 array problems".
 *
 * A challenge is a template plus a target date; per-user completion lives in
 * UserChallenge so the reward can be guarded against double-claiming.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

const { Schema } = mongoose;

const CHALLENGE_GOALS = [
    'solve_problems',
    'complete_lessons',
    'pass_quiz',
    'study_minutes',
    'complete_module',
];

const challengeSchema = new Schema({
    title: { type: String, required: true, trim: true, maxlength: 255 },
    description: { type: String, default: '', maxlength: 1000 },

    goalType: { type: String, enum: CHALLENGE_GOALS, required: true },
    goalTarget: { type: Number, required: true, min: 1 },

    // Optional narrowing, e.g. "2 problems tagged Arrays".
    tag: { type: Schema.Types.ObjectId, ref: 'Tag', default: null },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', null], default: null },

    xpReward: { type: Number, default: 75, min: 0 },

    // YYYY-MM-DD. The day this challenge is active.
    date: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// One challenge per goal type per day.
challengeSchema.index({ date: 1, goalType: 1 }, { unique: true });

challengeSchema.plugin(cascadeDelete, {
    children: [
        { model: 'UserChallenge', foreignKey: 'challenge' },
    ],
});

module.exports = mongoose.model('Challenge', challengeSchema);
module.exports.CHALLENGE_GOALS = CHALLENGE_GOALS;
