const express = require('express');
const { body } = require('express-validator');
const {
    register, login, refresh, logout, logoutAll, getProfile, updateProfile,
} = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * NOTE: there is no `role` validator on register or profile-update any more.
 * Accepting a role from the client is what made teaching a checkbox instead of
 * a milestone, and 'both' additionally passed every authorize() check.
 * Registration collects what the spec asks for: name, username, email,
 * password, interests.
 */
const registerValidation = [
    body('email')
        .isEmail().withMessage('Valid email is required')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .isLength({ max: 128 }).withMessage('Password too long')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
    body('full_name')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ max: 100 }).withMessage('Full name must be 100 characters or less')
        .escape(),
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username may contain only letters, numbers and underscores'),
    body('interests')
        .optional()
        .isArray({ max: 20 }).withMessage('Select at most 20 interests'),
];

const loginValidation = [
    body('email')
        .isEmail().withMessage('Valid email is required')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ max: 128 }).withMessage('Password too long'),
];

const profileUpdateValidation = [
    body('full_name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Full name must be between 1 and 100 characters')
        .escape(),
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Bio must be 500 characters or less'),
    body('timezone')
        .optional()
        .isString()
        .isLength({ max: 64 }).withMessage('Invalid timezone'),
    body('interests')
        .optional()
        .isArray({ max: 20 }).withMessage('Select at most 20 interests'),
];

// @route   POST /api/auth/register
// @desc    Register new user (always as a learner)
// @access  Public
router.post('/register', registerValidation, register);

// @route   POST /api/auth/login
// @access  Public
router.post('/login', loginValidation, login);

// @route   POST /api/auth/refresh
// @desc    Rotate the refresh token and issue a new access token
// @access  Public (requires valid refresh token cookie)
router.post('/refresh', refresh);

// @route   POST /api/auth/logout
// @access  Public (clears cookies regardless)
router.post('/logout', logout);

// @route   POST /api/auth/logout-all
// @access  Private
router.post('/logout-all', auth, logoutAll);

// @route   GET /api/auth/profile
// @access  Private
router.get('/profile', auth, getProfile);

// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', auth, profileUpdateValidation, updateProfile);

module.exports = router;
