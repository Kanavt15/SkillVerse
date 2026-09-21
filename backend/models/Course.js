/**
 * Course.
 *
 * `avgRating` and `reviewCount` stay denormalized, as in MySQL — the course
 * list sorts on them and recomputing per request would mean a $lookup into
 * reviews for every row. They are recalculated inside the review transaction.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

const { Schema } = mongoose;

const courseSchema = new Schema({
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },

    title: { type: String, required: true, trim: true, maxlength: 255 },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 10000 },
    thumbnail: { type: String, default: null },

    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner',
        index: true,
    },

    // Spec §14 course page fields.
    learningObjectives: [{ type: String, maxlength: 500 }],
    prerequisites: [{ type: String, maxlength: 500 }],

    durationHours: { type: Number, default: 0, min: 0 },

    // Currency cost/reward, in the unified wallet's credits.
    pointsCost: { type: Number, default: 0, min: 0 },
    pointsReward: { type: Number, default: 0, min: 0 },
    // Real-money price in paise (Razorpay's unit). Integer — never a float.
    price: { type: Number, default: 0, min: 0 },

    isPublished: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },

    // Denormalized rating aggregates, recomputed on review write.
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    // Denormalized so the course list doesn't $lookup enrollments per row.
    enrollmentCount: { type: Number, default: 0, min: 0 },
    lessonCount: { type: Number, default: 0, min: 0 },

    tags: [{ type: Schema.Types.ObjectId, ref: 'Tag', index: true }],
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// ------------------------------------------------------------------
// Indexes
// ------------------------------------------------------------------
// Replaces the FULLTEXT index in migration_advanced_search.sql:48. Weighted so
// a title match outranks a description match, approximating the relevance
// ordering MySQL's MATCH...AGAINST produced. Stemming and stopword behavior
// differ between the two engines, so result ORDER will not match exactly.
courseSchema.index(
    { title: 'text', description: 'text' },
    { weights: { title: 10, description: 3 }, name: 'course_text_search' }
);

// Course list sorts: newest, top rated, most popular.
courseSchema.index({ isPublished: 1, createdAt: -1 });
courseSchema.index({ isPublished: 1, avgRating: -1, reviewCount: -1 });
courseSchema.index({ isPublished: 1, enrollmentCount: -1 });
courseSchema.index({ instructor: 1, isPublished: 1 });

// ------------------------------------------------------------------
// Cascade — schema.sql:74,103,139,157,176 + adv_search:33
// ------------------------------------------------------------------
courseSchema.plugin(cascadeDelete, {
    children: [
        { model: 'Module', foreignKey: 'course' },
        { model: 'Lesson', foreignKey: 'course' },
        { model: 'Enrollment', foreignKey: 'course' },
        { model: 'Review', foreignKey: 'course' },
        { model: 'Certificate', foreignKey: 'course' },
        { model: 'DiscussionPost', foreignKey: 'course' },
        { model: 'Quiz', foreignKey: 'course' },
    ],
});

module.exports = mongoose.model('Course', courseSchema);
