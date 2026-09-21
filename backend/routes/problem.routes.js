const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const {
    listProblems, getProblem, runCode, submitSolution,
    getMySubmissions, getAllMySubmissions, getEngineInfo,
} = require('../controllers/problem.controller');
const { auth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

/**
 * Code submissions carry whole source files, which the global 10kb JSON cap
 * would reject. These routes parse with a larger limit.
 */
const codeBodyParser = express.json({ limit: '256kb' });

/**
 * Execution is the most expensive thing a user can ask for — every call burns
 * real CPU on the judge — so it gets a tighter limit than the global one.
 */
const executionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        if (req.logSecurity) req.logSecurity('RATE_LIMIT', { limiter: 'execution' });
        res.status(429).json({
            success: false,
            message: 'Too many runs. Give the judge a moment.',
        });
    },
});

const codeValidation = [
    body('language').isString().isLength({ min: 1, max: 20 }),
    body('code').isString().isLength({ min: 1, max: 100_000 })
        .withMessage('Code must be between 1 and 100,000 characters'),
];

/**
 * `optionalAuth` lets anonymous visitors browse problems while still
 * personalising the response (solved markers, editorial) for signed-in users.
 */
const optionalAuth = (req, res, next) => {
    if (!req.header('Authorization')) return next();
    return auth(req, res, next);
};

// @route   GET /api/problems/meta/engine
// @desc    Which execution engine is active and what it can run
// @access  Public
router.get('/meta/engine', getEngineInfo);

// @route   GET /api/problems/me/submissions
// @access  Private
router.get('/me/submissions', auth, getAllMySubmissions);

// @route   GET /api/problems
// @access  Public
router.get('/', optionalAuth, listProblems);

// @route   GET /api/problems/:slug
// @access  Public (richer when signed in)
router.get('/:slug', optionalAuth, getProblem);

// @route   GET /api/problems/:slug/submissions
// @access  Private
router.get('/:slug/submissions', auth, getMySubmissions);

// @route   POST /api/problems/:slug/run
// @desc    Execute against one input without grading or persisting
// @access  Private
router.post('/:slug/run', auth, executionLimiter, codeBodyParser, codeValidation, validate, runCode);

// @route   POST /api/problems/:slug/submit
// @desc    Grade against every test case
// @access  Private
router.post('/:slug/submit', auth, executionLimiter, codeBodyParser, codeValidation, validate, submitSolution);

module.exports = router;
