/**
 * LearningPath — a curated sequence of courses and problems (spec §27).
 *
 * Steps are embedded and ordered. Progress is not stored here: it is derived
 * from the learner's Enrollment and Submission records, so a path stays correct
 * when its steps are reordered or replaced.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const stepSchema = new Schema({
    order: { type: Number, required: true },
    kind: { type: String, enum: ['course', 'problem', 'quiz'], required: true },

    course: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
    problem: { type: Schema.Types.ObjectId, ref: 'Problem', default: null },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', default: null },

    // Optional steps count toward display but not toward completion.
    isOptional: { type: Boolean, default: false },
}, { _id: false });

const learningPathSchema = new Schema({
    title: { type: String, required: true, trim: true, maxlength: 255 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 5000 },
    thumbnail: { type: String, default: null },

    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner',
    },

    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    estimatedHours: { type: Number, default: 0, min: 0 },

    steps: { type: [stepSchema], default: [] },

    author: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isPublished: { type: Boolean, default: false, index: true },
    enrolledCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

learningPathSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('LearningPath', learningPathSchema);
