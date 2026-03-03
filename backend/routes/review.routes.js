const express = require('express');
const { body, param } = require('express-validator');
const {
    createReview,
    updateReview,
    deleteReview,
    getCourseReviews,
    getUserReview
} = require('../controllers/review.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// Validation rules
const reviewValidation = [
    body('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be an integer between 1 and 5'),
    body('comment')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Comment must be 2000 characters or less')
];

// @route   GET /api/reviews/course/:courseId
// @desc    Get paginated reviews for a course
// @access  Public
router.get('/course/:courseId', getCourseReviews);

// @route   GET /api/reviews/course/:courseId/mine
// @desc    Get authenticated user's review for a course
// @access  Private
router.get('/course/:courseId/mine', auth, getUserReview);

// @route   POST /api/reviews/course/:courseId
// @desc    Create a review for a course
// @access  Private
router.post('/course/:courseId', auth, reviewValidation, createReview);

// @route   PUT /api/reviews/:id
// @desc    Update own review
// @access  Private
router.put('/:id', auth, reviewValidation, updateReview);

// @route   DELETE /api/reviews/:id
// @desc    Delete own review
// @access  Private
router.delete('/:id', auth, deleteReview);

module.exports = router;
