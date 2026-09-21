/**
 * User — one account type for everyone.
 *
 * The MySQL schema had `role ENUM('learner','instructor','both')` chosen at
 * signup. That is replaced here by a single `user` role plus a `teaching`
 * subdocument that is EARNED, per the product spec: teaching is a milestone,
 * not a checkbox.
 *
 * This also removes a privilege-escalation hole. `authorize()` in
 * auth.middleware.js treated `role === 'both'` as a pass for EVERY role, so
 * introducing an admin role would have handed admin to every dual-role account.
 * With only 'user' and 'admin' there is no bypass value left.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

const { Schema } = mongoose;

/** Aggregate counters that drive teaching eligibility. */
const learningStatsSchema = new Schema({
    coursesCompleted: { type: Number, default: 0, min: 0 },
    lessonsCompleted: { type: Number, default: 0, min: 0 },
    problemsSolved: { type: Number, default: 0, min: 0 },
    quizzesCompleted: { type: Number, default: 0, min: 0 },
    // Running average of quiz scores (0-100). Recomputed on each attempt.
    averageQuizScore: { type: Number, default: 0, min: 0, max: 100 },
    learningMinutes: { type: Number, default: 0, min: 0 },
    reviewsPosted: { type: Number, default: 0, min: 0 },
    discussionsPosted: { type: Number, default: 0, min: 0 },
    helpfulAnswers: { type: Number, default: 0, min: 0 },
    certificatesEarned: { type: Number, default: 0, min: 0 },
}, { _id: false });

/**
 * Teaching capability. `isEligible` is a cached verdict — the authoritative
 * check always re-evaluates against PlatformSettings server-side, because the
 * thresholds are admin-configurable and can change after this was last written.
 */
const teachingSchema = new Schema({
    isEligible: { type: Boolean, default: false },
    unlockedAt: { type: Date, default: null },
    coursesCreated: { type: Number, default: 0, min: 0 },
    coursesPublished: { type: Number, default: 0, min: 0 },
    // Reserved for subject-specific unlock (spec §8). Empty means global unlock,
    // which is the mode shipped first.
    eligibleCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
}, { _id: false });

/** Streak state. Previously seven loose columns on `users`. */
const streakSchema = new Schema({
    current: { type: Number, default: 0, min: 0 },
    longest: { type: Number, default: 0, min: 0 },
    // Stored as a YYYY-MM-DD string in the user's own timezone, not a Date.
    // A Date would re-introduce the UTC round-trip that makes the existing
    // streak calculation off-by-one on non-UTC servers.
    lastActivityDate: { type: String, default: null },
    freezeCount: { type: Number, default: 0, min: 0 },
}, { _id: false });

/**
 * Single unified currency.
 *
 * MySQL had two ledgers that disagreed: `users.points` (+ point_transactions)
 * and `wallets.balance` (+ wallet_transactions). Enrollment debited the wallet
 * while course-completion rewards credited points, so earned rewards were only
 * ever spendable on streak freezes — and instructor revenue, computed from
 * point_transactions, was structurally always zero. One balance fixes all three.
 */
const walletSchema = new Schema({
    balance: { type: Number, default: 0, min: 0 },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
}, { _id: false });

const userSchema = new Schema({
    fullName: { type: String, required: true, trim: true, maxlength: 255 },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 30,
        match: [/^[a-z0-9_]+$/, 'Username may contain only letters, numbers and underscores'],
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        maxlength: 255,
    },
    password: { type: String, required: true, select: false },

    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },

    bio: { type: String, default: '', maxlength: 2000 },
    profileImage: { type: String, default: null },

    // Chosen at registration; drives dashboard recommendations.
    interests: [{ type: Schema.Types.ObjectId, ref: 'Category' }],

    xp: { type: Number, default: 0, min: 0, index: true },
    level: { type: Number, default: 1, min: 1 },

    learningStats: { type: learningStatsSchema, default: () => ({}) },
    teaching: { type: teachingSchema, default: () => ({}) },
    streak: { type: streakSchema, default: () => ({}) },
    wallet: { type: walletSchema, default: () => ({}) },

    // IANA timezone, used for streak day boundaries.
    timezone: { type: String, default: 'UTC' },

    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null, select: false },
    passwordResetToken: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },

    isSuspended: { type: Boolean, default: false },
    suspendedReason: { type: String, default: null },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// ------------------------------------------------------------------
// Indexes
// ------------------------------------------------------------------
// Leaderboards sort by xp descending; rank is countDocuments({xp:{$gt}}).
userSchema.index({ xp: -1, createdAt: 1 });
userSchema.index({ 'teaching.isEligible': 1 });
// Profile/teacher search.
userSchema.index({ fullName: 'text', username: 'text' });

// ------------------------------------------------------------------
// Cascade
// ------------------------------------------------------------------
// Mirrors the ON DELETE CASCADE chain rooted at `users` in schema.sql.
// Follow appears twice because the FK pointed at users from both sides.
userSchema.plugin(cascadeDelete, {
    children: [
        { model: 'Course', foreignKey: 'instructor' },
        { model: 'Enrollment', foreignKey: 'user' },
        { model: 'Review', foreignKey: 'user' },
        { model: 'Certificate', foreignKey: 'user' },
        { model: 'DiscussionPost', foreignKey: 'author' },
        { model: 'DiscussionVote', foreignKey: 'user' },
        { model: 'Notification', foreignKey: 'user' },
        { model: 'Follow', foreignKey: 'follower' },
        { model: 'Follow', foreignKey: 'following' },
        { model: 'WalletTransaction', foreignKey: 'user' },
        { model: 'XpTransaction', foreignKey: 'user' },
        { model: 'DailyActivity', foreignKey: 'user' },
        { model: 'UserAchievement', foreignKey: 'user' },
        { model: 'StreakFreeze', foreignKey: 'user' },
        { model: 'ActivityAuditLog', foreignKey: 'user' },
        { model: 'RefreshToken', foreignKey: 'user' },
        { model: 'Submission', foreignKey: 'user' },
        { model: 'QuizAttempt', foreignKey: 'user' },
        { model: 'UserChallenge', foreignKey: 'user' },
    ],
});

// ------------------------------------------------------------------
// Virtuals & helpers
// ------------------------------------------------------------------

/** Convenience for route guards. Teaching is never inferred from `role`. */
userSchema.virtual('canTeach').get(function canTeach() {
    return this.teaching?.isEligible === true;
});

userSchema.virtual('isAdmin').get(function isAdmin() {
    return this.role === 'admin';
});

/**
 * Strip secrets from anything that leaves the server. `password` and the token
 * fields are `select: false`, but an explicit re-select would otherwise leak.
 */
userSchema.methods.toSafeJSON = function toSafeJSON() {
    const obj = this.toObject({ virtuals: true });
    delete obj.password;
    delete obj.emailVerificationToken;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpires;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
