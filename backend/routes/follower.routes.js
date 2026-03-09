const express = require('express');
const { param } = require('express-validator');
const {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    isFollowing
} = require('../controllers/follower.controller');
const { auth } = require('../middleware/auth.middleware');
const { validationResult } = require('express-validator');

const router = express.Router();

// Validation error handler
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

const userIdValidation = [
    param('userId').isInt({ min: 1 }).withMessage('Valid user ID is required')
];

// @route   POST /api/followers/:userId
// @desc    Follow a user
// @access  Private
router.post('/:userId', auth, userIdValidation, validate, followUser);

// @route   DELETE /api/followers/:userId
// @desc    Unfollow a user
// @access  Private
router.delete('/:userId', auth, userIdValidation, validate, unfollowUser);

// @route   GET /api/followers/:userId/followers
// @desc    Get user's followers
// @access  Public
router.get('/:userId/followers', userIdValidation, validate, getFollowers);

// @route   GET /api/followers/:userId/following
// @desc    Get who user follows
// @access  Public
router.get('/:userId/following', userIdValidation, validate, getFollowing);

// @route   GET /api/followers/:userId/is-following
// @desc    Check if current user follows a target user
// @access  Private
router.get('/:userId/is-following', auth, userIdValidation, validate, isFollowing);

module.exports = router;
