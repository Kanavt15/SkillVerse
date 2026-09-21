/**
 * Quiz — questions embedded, per the spec's question types (§20).
 *
 * Questions are embedded rather than a separate collection: they are bounded
 * (tens, not thousands), only ever read as a complete quiz, and have no
 * independent identity. The MySQL design would have needed a Question table
 * plus a join on every attempt.
 *
 * SECURITY: `questions.$.correctAnswers` and `.explanation` are stripped by
 * `forLearner()` before the quiz is sent out. Embedding answers next to the
 * questions makes it easy to leak them, so never return raw documents.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

const { Schema } = mongoose;

const QUESTION_TYPES = [
    'multiple_choice',   // exactly one correct option
    'multiple_select',   // one or more correct options
    'true_false',
    'code_output',       // "what does this print?"
    'conceptual',        // free text, manually or keyword graded
];

const optionSchema = new Schema({
    id: { type: String, required: true },
    text: { type: String, required: true, maxlength: 2000 },
}, { _id: false });

const questionSchema = new Schema({
    order: { type: Number, required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },

    prompt: { type: String, required: true, maxlength: 5000 },
    // Present for code_output questions.
    codeSnippet: { type: String, default: null },
    language: { type: String, default: null },

    options: { type: [optionSchema], default: [] },
    // Option ids. Always an array, even for single-answer types, so scoring
    // has one code path.
    correctAnswers: { type: [String], default: [] },

    explanation: { type: String, default: '', maxlength: 2000 },
    points: { type: Number, default: 1, min: 0 },
}, { _id: false });

const quizSchema = new Schema({
    title: { type: String, required: true, trim: true, maxlength: 255 },
    description: { type: String, default: '', maxlength: 2000 },

    // A quiz belongs to a course/module/lesson, or stands alone.
    course: { type: Schema.Types.ObjectId, ref: 'Course', default: null, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', default: null, index: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', default: null, index: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null },

    questions: { type: [questionSchema], default: [] },

    passingScore: { type: Number, default: 70, min: 0, max: 100 },
    timeLimitMinutes: { type: Number, default: null, min: 1 },
    maxAttempts: { type: Number, default: null, min: 1 },

    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isPublished: { type: Boolean, default: false, index: true },
}, { timestamps: true });

quizSchema.plugin(cascadeDelete, {
    children: [
        { model: 'QuizAttempt', foreignKey: 'quiz' },
    ],
});

/** Total points available, used to normalize a score to a percentage. */
quizSchema.virtual('totalPoints').get(function totalPoints() {
    return (this.questions || []).reduce((sum, q) => sum + (q.points || 0), 0);
});

/**
 * The quiz as a learner may see it: no correct answers, no explanations.
 * Explanations are returned separately, after the attempt is submitted.
 */
quizSchema.methods.forLearner = function forLearner() {
    const obj = this.toObject();
    obj.questions = (obj.questions || []).map((q) => {
        const { correctAnswers, explanation, ...safe } = q;
        return safe;
    });
    return obj;
};

module.exports = mongoose.model('Quiz', quizSchema);
module.exports.QUESTION_TYPES = QUESTION_TYPES;
