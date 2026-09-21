/**
 * QuizAttempt — a learner's submitted answers and the resulting score.
 *
 * Attempts are kept rather than overwritten so `averageQuizScore` (which feeds
 * teaching eligibility) has an auditable basis, and so retakes are visible.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const answerSchema = new Schema({
    questionOrder: { type: Number, required: true },
    selected: { type: [String], default: [] },
    // Free text for conceptual questions.
    text: { type: String, default: null },
    isCorrect: { type: Boolean, required: true },
    pointsEarned: { type: Number, default: 0, min: 0 },
}, { _id: false });

const quizAttemptSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },

    answers: { type: [answerSchema], default: [] },

    // Percentage, 0-100.
    score: { type: Number, required: true, min: 0, max: 100 },
    pointsEarned: { type: Number, default: 0, min: 0 },
    totalPoints: { type: Number, default: 0, min: 0 },
    passed: { type: Boolean, required: true },

    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now },
    durationSeconds: { type: Number, default: 0, min: 0 },

    xpAwarded: { type: Number, default: 0, min: 0 },
    // Which attempt this is, for maxAttempts enforcement.
    attemptNumber: { type: Number, default: 1, min: 1 },
}, { timestamps: true });

quizAttemptSchema.index({ user: 1, quiz: 1, createdAt: -1 });
quizAttemptSchema.index({ quiz: 1, score: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
