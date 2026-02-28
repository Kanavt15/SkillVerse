const express = require('express');
const { body } = require('express-validator');
const { register, login, getProfile, updateProfile } = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// Validation rules — strong password policy
const registerValidation = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ max: 100 }).withMessage('Full name must be 100 characters or less')
    .escape(),
  body('role')
    .optional()
    .isIn(['learner', 'instructor', 'both']).withMessage('Invalid role')
];

const loginValidation = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 128 }).withMessage('Password too long')
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
  body('role')
    .optional()
    .isIn(['learner', 'instructor', 'both']).withMessage('Invalid role')
];

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', registerValidation, register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, login);

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', auth, getProfile);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, profileUpdateValidation, updateProfile);

module.exports = router;
