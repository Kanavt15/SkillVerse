/**
 * Enrollment — a user's registration in a course.
 *
 * `progressPercentage` is a denormalized cache recomputed whenever a lesson is
 * completed. Keeping it on the document is what lets the "My Learning" screen
 * render without aggregating LessonProgress per course.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

const { Schema } = mongoose;

const enrollmentSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    enrolledAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },

    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },

    // What the learner paid, captured at enrollment time so later price changes
    // don't rewrite history.
    pointsPaid: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

// Replaces `unique_enrollment (user_id, course_id)`. enrollCourse relies on
// this to reject double enrollment.
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ user: 1, enrolledAt: -1 });
// Instructor dashboard: enrollments across a set of courses.
enrollmentSchema.index({ course: 1, completedAt: 1 });

enrollmentSchema.plugin(cascadeDelete, {
    children: [
        { model: 'LessonProgress', foreignKey: 'enrollment' },
    ],
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);
