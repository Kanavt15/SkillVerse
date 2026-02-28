const express = require('express');
const { query } = require('express-validator');
const { getBalance, getTransactions } = require('../controllers/points.controller');
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

// @route   GET /api/points
// @desc    Get user's points balance
// @access  Private
router.get('/', auth, getBalance);

// @route   GET /api/points/transactions
// @desc    Get user's point transaction history
// @access  Private
router.get('/transactions',
    auth,
    [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    ],
    validate,
    getTransactions
);

module.exports = router;
