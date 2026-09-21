/**
 * Achievement — badge definitions (was `badge_definitions`).
 *
 * Renamed to match the spec's vocabulary. Definitions are data, not code, so
 * admins can add new ones without a deploy (spec §23); the 43 badges seeded by
 * migration_gamification.sql move into the seed script.
 *
 * NOTE: MySQL had two conflicting `user_badges` definitions — one in
 * database/migration_gamification.sql with an FK to badge_definitions, and one
 * auto-created by config/database.js with no badge_definitions table at all.
 * On a fresh database the second won and badge awarding broke outright. This
 * model follows the migration file, which is the one the service code expects.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

/** The criteria the evaluator knows how to check. */
const CRITERIA_TYPES = [
    'streak_days',
    'courses_completed',
    'lessons_completed',
    'total_xp',
    'level_reached',
    'time_spent_hours',
    'reviews_posted',
    'discussions_posted',
    'helpful_answers',
    'certificates_earned',
    'categories_explored',
    'early_bird',
    'night_owl',
    'weekend_warrior',
    'perfect_course',
    // New, for the spec's features
    'problems_solved',
    'quizzes_completed',
    'teaching_unlocked',
    'challenges_completed',
];

const achievementSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 500 },
    icon: { type: String, default: null, maxlength: 50 },

    category: {
        type: String,
        enum: ['streak', 'completion', 'engagement', 'mastery', 'social', 'special'],
        required: true,
    },
    tier: {
        type: String,
        enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
        default: 'bronze',
    },

    xpReward: { type: Number, default: 0, min: 0 },

    criteriaType: { type: String, enum: CRITERIA_TYPES, required: true },
    criteriaValue: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

achievementSchema.plugin(cascadeDelete, {
    children: [
        { model: 'UserAchievement', foreignKey: 'achievement' },
    ],
});

module.exports = mongoose.model('Achievement', achievementSchema);
module.exports.CRITERIA_TYPES = CRITERIA_TYPES;
