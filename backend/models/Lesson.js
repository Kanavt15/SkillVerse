/**
 * Lesson.
 *
 * `lesson_resources` was its own table with an FK back to lessons; it is
 * embedded here instead. Resources are bounded (a handful of PDFs per lesson),
 * always read together with the lesson, and never queried independently —
 * exactly the case for embedding.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

const { Schema } = mongoose;

const resourceSchema = new Schema({
    resourceType: {
        type: String,
        enum: ['pdf', 'document', 'code', 'other'],
        required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 255 },
    fileUrl: { type: String, required: true, maxlength: 500 },
    fileSize: { type: Number, default: null, min: 0 },
}, { timestamps: true });

const lessonSchema = new Schema({
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    // Nullable so a lesson can exist before modules are introduced to a course.
    module: { type: Schema.Types.ObjectId, ref: 'Module', default: null, index: true },

    title: { type: String, required: true, trim: true, maxlength: 255 },
    description: { type: String, default: '', maxlength: 5000 },
    order: { type: Number, required: true, min: 0 },

    videoUrl: { type: String, default: null, maxlength: 500 },
    durationMinutes: { type: Number, default: 0, min: 0 },
    content: { type: String, default: '' },

    // Free lessons are previewable without enrolling.
    isFree: { type: Boolean, default: false },

    resources: { type: [resourceSchema], default: [] },
}, { timestamps: true });

lessonSchema.index({ course: 1, order: 1 });

lessonSchema.plugin(cascadeDelete, {
    children: [
        { model: 'LessonProgress', foreignKey: 'lesson' },
        { model: 'DiscussionPost', foreignKey: 'lesson' },
    ],
});

module.exports = mongoose.model('Lesson', lessonSchema);
