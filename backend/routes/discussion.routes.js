const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const {
    createPost,
    getPosts,
    getReplies,
    updatePost,
    deletePost,
    toggleVote
} = require('../controllers/discussion.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// ─── Validation rules ────────────────────────────────────────────────────────
const postValidation = [
    body('content')
        .trim()
        .notEmpty().withMessage('Content is required')
        .isLength({ max: 5000 }).withMessage('Content must be 5000 characters or less'),
    body('parent_id')
        .optional({ nullable: true })
        .isInt({ min: 1 }).withMessage('parent_id must be a positive integer'),
    body('lesson_id')
        .optional({ nullable: true })
        .isInt({ min: 1 }).withMessage('lesson_id must be a positive integer')
];

const updateValidation = [
    body('content')
        .trim()
        .notEmpty().withMessage('Content is required')
        .isLength({ max: 5000 }).withMessage('Content must be 5000 characters or less')
];

// ─── Per-user anti-spam rate limiter (5 posts per 5 minutes) ─────────────────
const discussionLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5,
    keyGenerator: (req) => `discussion_${req.user?.id || req.ip}`,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        if (req.logSecurity) {
            req.logSecurity('RATE_LIMIT', { limiter: 'discussion', userId: req.user?.id });
        }
        res.status(429).json({
            success: false,
            message: 'You are posting too quickly. Please wait a few minutes before posting again.'
        });
    }
});

// ─── Optional auth — attaches req.user if token present, but doesn't block ──
const optionalAuth = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return auth(req, res, next);
    }
    next();
};

// ─── Routes ──────────────────────────────────────────────────────────────────

// @route   GET /api/discussions/course/:courseId
// @desc    Get paginated top-level discussion posts for a course
// @access  Public (optional auth for vote status)
router.get('/course/:courseId', optionalAuth, getPosts);

// @route   GET /api/discussions/:postId/replies
// @desc    Get paginated replies for a discussion post
// @access  Public (optional auth for vote status)
router.get('/:postId/replies', optionalAuth, getReplies);

// @route   POST /api/discussions/course/:courseId
// @desc    Create a discussion post (question or reply)
// @access  Private (enrolled users & course instructor)
router.post('/course/:courseId', auth, discussionLimiter, postValidation, createPost);

// @route   PUT /api/discussions/:postId
// @desc    Update own discussion post
// @access  Private
router.put('/:postId', auth, updateValidation, updatePost);

// @route   DELETE /api/discussions/:postId
// @desc    Delete own discussion post
// @access  Private
router.delete('/:postId', auth, deletePost);

// @route   POST /api/discussions/:postId/vote
// @desc    Toggle upvote on a discussion post
// @access  Private
router.post('/:postId/vote', auth, toggleVote);

module.exports = router;
