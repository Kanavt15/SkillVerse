/**
 * LessonProgress — per-lesson completion state within an enrollment.
 *
 * Kept as its own collection rather than an array on Enrollment: it is written
 * on every lesson completion (a hot path), queried independently by the
 * anti-cheat rate checks, and would otherwise grow an unbounded array inside a
 * document that is read on every dashboard load.
 *
 * NOTE ON THE PROGRESS DENOMINATOR: rows are materialized for every lesson at
 * enrollment time, so lessons added to a course AFTER a learner enrols never
 * enter that learner's denominator. This reproduces the MySQL behavior
 * deliberately — changing it is a product decision, not a migration one.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const lessonProgressSchema = new Schema({
    enrollment: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    // Denormalized for the anti-cheat hourly/daily rate queries, which would
    // otherwise need a $lookup through Enrollment on every lesson completion.
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    timeSpentMinutes: { type: Number, default: 0, min: 0 },
    lastAccessedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Replaces `unique_lesson_progress (enrollment_id, lesson_id)`.
lessonProgressSchema.index({ enrollment: 1, lesson: 1 }, { unique: true });
// Anti-cheat: "how many lessons has this user completed in the last hour/day".
lessonProgressSchema.index({ user: 1, completedAt: -1 });
lessonProgressSchema.index({ enrollment: 1, isCompleted: 1 });

module.exports = mongoose.model('LessonProgress', lessonProgressSchema);
