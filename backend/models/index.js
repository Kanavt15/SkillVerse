/**
 * Model registry.
 *
 * Requiring this module registers every schema with Mongoose. That matters for
 * the cascade plugin, which resolves children by model NAME via
 * mongoose.model('Course') — if a model has not been registered by the time a
 * delete fires, the cascade throws MissingSchemaError instead of silently
 * skipping. Import from here, not from individual files, so registration order
 * is never a question.
 *
 * FIELD NAMING: models use camelCase, which is idiomatic Mongoose. The existing
 * frontend consumes the MySQL snake_case shape (full_name, instructor_id,
 * avg_rating). Controllers therefore serialize to the legacy shape during
 * Phase C so the current UI keeps working as the integration test; Phase D
 * moves the frontend to camelCase and the serializers are deleted.
 */

// Core identity & access
const User = require('./User');
const RefreshToken = require('./RefreshToken');
const PlatformSettings = require('./PlatformSettings');

// Content
const Category = require('./Category');
const Tag = require('./Tag');
const Course = require('./Course');
const Module = require('./Module');
const Lesson = require('./Lesson');

// Learning & progress
const Enrollment = require('./Enrollment');
const LessonProgress = require('./LessonProgress');
const Certificate = require('./Certificate');

// Social
const Review = require('./Review');
const DiscussionPost = require('./DiscussionPost');
const DiscussionVote = require('./DiscussionVote');
const Follow = require('./Follow');
const Notification = require('./Notification');

// Gamification
const Achievement = require('./Achievement');
const UserAchievement = require('./UserAchievement');
const XpTransaction = require('./XpTransaction');
const DailyActivity = require('./DailyActivity');
const StreakFreeze = require('./StreakFreeze');
const ActivityAuditLog = require('./ActivityAuditLog');
const Challenge = require('./Challenge');
const UserChallenge = require('./UserChallenge');

// Currency
const WalletTransaction = require('./WalletTransaction');
const PointPackage = require('./PointPackage');

// Practice & assessment
const Problem = require('./Problem');
const Submission = require('./Submission');
const Quiz = require('./Quiz');
const QuizAttempt = require('./QuizAttempt');
const LearningPath = require('./LearningPath');

module.exports = {
    User,
    RefreshToken,
    PlatformSettings,
    Category,
    Tag,
    Course,
    Module,
    Lesson,
    Enrollment,
    LessonProgress,
    Certificate,
    Review,
    DiscussionPost,
    DiscussionVote,
    Follow,
    Notification,
    Achievement,
    UserAchievement,
    XpTransaction,
    DailyActivity,
    StreakFreeze,
    ActivityAuditLog,
    Challenge,
    UserChallenge,
    WalletTransaction,
    PointPackage,
    Problem,
    Submission,
    Quiz,
    QuizAttempt,
    LearningPath,
};
