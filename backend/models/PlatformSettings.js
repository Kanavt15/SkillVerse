/**
 * PlatformSettings — the single source of truth for every tunable number.
 *
 * The spec is explicit that XP values, level thresholds and teaching
 * requirements must be admin-configurable and "not hardcoded throughout the
 * application" (§5). Today they are literals in xp.service.js with no config
 * path at all, so changing the cost of a lesson means a deploy.
 *
 * This is a SINGLETON: exactly one document, fetched via `getSettings()` and
 * cached in memory. Never construct it directly.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

/** XP awarded per event. Defaults follow the spec's §21 table. */
const xpRulesSchema = new Schema({
    lessonComplete: { type: Number, default: 20 },
    firstLessonDaily: { type: Number, default: 5 },
    quizPassed: { type: Number, default: 30 },
    courseComplete: { type: Number, default: 500 },
    problemEasy: { type: Number, default: 20 },
    problemMedium: { type: Number, default: 50 },
    problemHard: { type: Number, default: 100 },
    dailyChallenge: { type: Number, default: 75 },
    discussionPost: { type: Number, default: 5 },
    discussionHelpful: { type: Number, default: 10 },
    reviewPosted: { type: Number, default: 15 },

    // Daily caps, to stop XP farming. The MySQL code declared these but never
    // called the function that enforced them.
    dailyLimits: {
        discussionPost: { type: Number, default: 5 },
        reviewPosted: { type: Number, default: 3 },
    },

    // Bonus XP at streak milestones, keyed by day count.
    streakBonuses: {
        type: Map,
        of: Number,
        default: () => new Map([
            ['7', 25], ['14', 50], ['30', 100],
            ['60', 250], ['100', 500], ['365', 2000],
        ]),
    },
}, { _id: false });

/**
 * Level curve.
 *
 * `xpForLevel(n) = baseXP * (n-1)^exponent`, inverted exactly for
 * `levelForXP`. The MySQL implementation used two formulas that were NOT
 * inverses of each other, so "XP into current level" could come out negative.
 * Deriving both directions from one curve makes that impossible.
 */
const levelRulesSchema = new Schema({
    baseXP: { type: Number, default: 100 },
    exponent: { type: Number, default: 1.5 },
    maxLevel: { type: Number, default: 100 },
    // Display names by level; falls back to "Level N" when absent.
    titles: {
        type: Map,
        of: String,
        default: () => new Map([
            ['1', 'Beginner'], ['2', 'Explorer'], ['3', 'Learner'],
            ['4', 'Developer'], ['5', 'Problem Solver'], ['6', 'Coder'],
            ['7', 'Advanced Learner'], ['8', 'Engineer'], ['9', 'Specialist'],
            ['10', 'Knowledge Mentor'],
        ]),
    },
}, { _id: false });

/** Thresholds a learner must cross before teaching unlocks (spec §5). */
const teachingRequirementsSchema = new Schema({
    enabled: { type: Boolean, default: true },
    requiredLevel: { type: Number, default: 10, min: 1 },
    requiredXP: { type: Number, default: 5000, min: 0 },
    requiredCoursesCompleted: { type: Number, default: 3, min: 0 },
    requiredProblemsSolved: { type: Number, default: 50, min: 0 },
    requiredQuizAverage: { type: Number, default: 70, min: 0, max: 100 },

    // 'global' unlocks teaching outright. 'subject' requires proving expertise
    // per category (spec §8). Global ships first; the field exists so the
    // switch is a settings change rather than a schema migration.
    unlockMode: { type: String, enum: ['global', 'subject'], default: 'global' },
}, { _id: false });

const platformSettingsSchema = new Schema({
    // Guarantees singleton-ness: a second insert violates the unique index.
    key: { type: String, default: 'default', unique: true, immutable: true },

    xpRules: { type: xpRulesSchema, default: () => ({}) },
    levelRules: { type: levelRulesSchema, default: () => ({}) },
    teachingRequirements: { type: teachingRequirementsSchema, default: () => ({}) },

    registrationWelcomeBonus: { type: Number, default: 500, min: 0 },
    streakFreezeCost: { type: Number, default: 100, min: 0 },

    // Anti-cheat thresholds, previously hardcoded in antiCheat.service.js.
    antiCheat: {
        minLessonSeconds: { type: Number, default: 30 },
        maxLessonsPerHour: { type: Number, default: 20 },
        maxLessonsPerDay: { type: Number, default: 100 },
    },
}, { timestamps: true });

// ------------------------------------------------------------------
// Singleton accessor with an in-process cache
// ------------------------------------------------------------------
let cached = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

/**
 * Fetch the settings document, creating it with defaults on first call.
 * Cached for a minute so the hot XP path doesn't hit the database per award.
 */
platformSettingsSchema.statics.getSettings = async function getSettings(force = false) {
    if (!force && cached && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cached;
    }
    let doc = await this.findOne({ key: 'default' });
    if (!doc) {
        doc = await this.create({ key: 'default' });
    }
    cached = doc;
    cachedAt = Date.now();
    return doc;
};

/** Drop the cache. Call after an admin writes new settings. */
platformSettingsSchema.statics.invalidateCache = function invalidateCache() {
    cached = null;
    cachedAt = 0;
};

// ------------------------------------------------------------------
// Level curve — one formula, both directions
// ------------------------------------------------------------------

/** Total XP required to reach `level`. Level 1 starts at 0. */
platformSettingsSchema.methods.xpForLevel = function xpForLevel(level) {
    if (level <= 1) return 0;
    const { baseXP, exponent } = this.levelRules;
    return Math.floor(baseXP * Math.pow(level - 1, exponent));
};

/**
 * The level a given total XP corresponds to — the exact inverse of xpForLevel.
 *
 * The closed form is only an approximation because xpForLevel() floors its
 * result, which leaves the analytic inverse sitting a hair below the integer
 * (e.g. xpForLevel(3) = 282, but (282/100)^(1/1.5) = 2.9996 -> floors to 2).
 * So the closed form is used as a seed and then corrected against the real
 * curve. Defined as: the largest L where xpForLevel(L) <= totalXP.
 */
platformSettingsSchema.methods.levelForXP = function levelForXP(totalXP) {
    if (totalXP <= 0) return 1;
    const { baseXP, exponent, maxLevel } = this.levelRules;

    let level = Math.floor(Math.pow(totalXP / baseXP, 1 / exponent)) + 1;
    level = Math.min(Math.max(level, 1), maxLevel);

    // Correct the seed. Each loop runs at most once or twice in practice.
    while (level < maxLevel && this.xpForLevel(level + 1) <= totalXP) level += 1;
    while (level > 1 && this.xpForLevel(level) > totalXP) level -= 1;

    return level;
};

/** Progress within the current level, for the dashboard's XP bar. */
platformSettingsSchema.methods.xpProgress = function xpProgress(totalXP) {
    const level = this.levelForXP(totalXP);
    const floorXP = this.xpForLevel(level);
    const ceilXP = this.xpForLevel(level + 1);
    const span = Math.max(ceilXP - floorXP, 1);
    const into = Math.max(totalXP - floorXP, 0);

    return {
        level,
        title: this.levelRules.titles?.get(String(level)) || `Level ${level}`,
        totalXP,
        xpInCurrentLevel: into,
        xpNeededForNext: span,
        progressPercentage: Math.min(Math.round((into / span) * 100), 100),
    };
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
