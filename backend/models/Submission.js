/**
 * Submission — one graded attempt at a Problem.
 *
 * `isFirstAccept` is what stops XP farming. The spec requires that resubmitting
 * an already-solved problem earns nothing, so XP is awarded only when this flag
 * is set, and it can only be set once per (user, problem) — enforced by the
 * partial unique index below rather than by a read-then-write check that two
 * concurrent submissions could both pass.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const VERDICTS = [
    'pending',
    'running',
    'accepted',
    'wrong_answer',
    'compilation_error',
    'runtime_error',
    'time_limit_exceeded',
    'memory_limit_exceeded',
    'internal_error',
];

/** Per-test outcome. Inputs of hidden cases are not echoed back. */
const testResultSchema = new Schema({
    order: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    isHidden: { type: Boolean, default: true },
    // Populated only for visible cases, so a learner cannot reconstruct the
    // hidden suite from failure output.
    input: { type: String, default: null },
    expectedOutput: { type: String, default: null },
    actualOutput: { type: String, default: null },
    runtimeMs: { type: Number, default: null },
    memoryKB: { type: Number, default: null },
}, { _id: false });

const submissionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problem: { type: Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },

    language: { type: String, required: true },
    code: { type: String, required: true, maxlength: 100000 },

    verdict: { type: String, enum: VERDICTS, default: 'pending', index: true },

    testResults: { type: [testResultSchema], default: [] },
    passedCount: { type: Number, default: 0, min: 0 },
    totalCount: { type: Number, default: 0, min: 0 },

    runtimeMs: { type: Number, default: null },
    memoryKB: { type: Number, default: null },

    // Compiler/runtime output. Truncated before storage.
    stderr: { type: String, default: null, maxlength: 10000 },
    compileOutput: { type: String, default: null, maxlength: 10000 },

    // True on the submission that first solved this problem for this user.
    isFirstAccept: { type: Boolean, default: false },
    xpAwarded: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

// Submission history for a problem page.
submissionSchema.index({ user: 1, problem: 1, createdAt: -1 });
submissionSchema.index({ user: 1, createdAt: -1 });

// At most ONE first-accept per (user, problem). A partial index only covers
// documents where isFirstAccept is true, so the many ordinary submissions are
// unconstrained while the award itself cannot be duplicated — even if two
// submissions are graded concurrently.
submissionSchema.index(
    { user: 1, problem: 1 },
    { unique: true, partialFilterExpression: { isFirstAccept: true } }
);

module.exports = mongoose.model('Submission', submissionSchema);
module.exports.VERDICTS = VERDICTS;
