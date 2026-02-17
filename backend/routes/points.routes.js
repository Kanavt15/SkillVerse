const express = require('express');
const { getBalance, getTransactions } = require('../controllers/points.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// @route   GET /api/points
// @desc    Get user's points balance
// @access  Private
router.get('/', auth, getBalance);

// @route   GET /api/points/transactions
// @desc    Get user's point transaction history
// @access  Private
router.get('/transactions', auth, getTransactions);

module.exports = router;
