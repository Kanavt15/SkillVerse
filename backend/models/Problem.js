/**
 * Problem — a Practice Arena coding challenge.
 *
 * SECURITY: `testCases` is `select: false`. Hidden test cases are the entire
 * basis of grading, and a single careless `Problem.findById(id)` sent straight
 * to the client would hand every learner the answer key. Making them opt-in
 * means leaking them requires deliberately asking for them.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

const { Schema } = mongoose;

/** Languages the judge supports, mapped to Judge0 language ids. */
const SUPPORTED_LANGUAGES = {
    c: 50,
    cpp: 54,
    java: 62,
    python: 71,
    javascript: 63,
};

/** A worked example shown in the problem statement. */
const exampleSchema = new Schema({
    input: { type: String, required: true },
    output: { type: String, required: true },
    explanation: { type: String, default: '' },
}, { _id: false });

/** A graded test case. Hidden ones are never sent to the client. */
const testCaseSchema = new Schema({
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isHidden: { type: Boolean, default: true },
    // Ordering so failure reports are stable between runs.
    order: { type: Number, default: 0 },
}, { _id: false });

const problemSchema = new Schema({
    title: { type: String, required: true, trim: true, maxlength: 255 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        required: true,
        index: true,
    },

    description: { type: String, required: true },
    constraints: { type: String, default: '' },
    inputFormat: { type: String, default: '' },
    outputFormat: { type: String, default: '' },

    examples: { type: [exampleSchema], default: [] },
    testCases: { type: [testCaseSchema], default: [], select: false },

    tags: [{ type: Schema.Types.ObjectId, ref: 'Tag', index: true }],
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },

    // Per-language starter templates, keyed by language slug.
    starterCode: { type: Map, of: String, default: () => new Map() },
    supportedLanguages: {
        type: [String],
        enum: Object.keys(SUPPORTED_LANGUAGES),
        default: Object.keys(SUPPORTED_LANGUAGES),
    },

    // Written by whoever created the problem; revealed after a first accept.
    editorial: { type: String, default: '' },

    // Judge limits. Seconds and kilobytes, matching Judge0's units.
    timeLimitSeconds: { type: Number, default: 5, min: 1, max: 15 },
    memoryLimitKB: { type: Number, default: 128000, min: 16000 },

    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isPublished: { type: Boolean, default: false, index: true },

    // Denormalized so the problem list doesn't aggregate submissions per row.
    solvedCount: { type: Number, default: 0, min: 0 },
    attemptCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

problemSchema.index({ title: 'text', description: 'text' });
problemSchema.index({ isPublished: 1, difficulty: 1 });
problemSchema.index({ isPublished: 1, solvedCount: -1 });

problemSchema.plugin(cascadeDelete, {
    children: [
        { model: 'Submission', foreignKey: 'problem' },
    ],
});

/** Only the test cases safe to show alongside the statement. */
problemSchema.methods.visibleTestCases = function visibleTestCases() {
    return (this.testCases || []).filter((tc) => !tc.isHidden);
};

module.exports = mongoose.model('Problem', problemSchema);
module.exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
