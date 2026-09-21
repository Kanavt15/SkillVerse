/**
 * Review — one rating per user per course.
 *
 * The MySQL CHECK (rating >= 1 AND rating <= 5) becomes min/max validators.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const reviewSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 5000 },
}, { timestamps: true });

// Replaces `unique_review (user_id, course_id)`. createReview leans on this as
// its second line of defense against duplicates.
reviewSchema.index({ user: 1, course: 1 }, { unique: true });
reviewSchema.index({ course: 1, createdAt: -1 });
reviewSchema.index({ course: 1, rating: 1 });

module.exports = mongoose.model('Review', reviewSchema);
