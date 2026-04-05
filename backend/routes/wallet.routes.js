const express = require('express');
const router = express.Router();
const {
  getWallet,
  getWalletTransactions,
  getWalletSummary
} = require('../controllers/wallet.controller');
const { auth } = require('../middleware/auth.middleware');

// All wallet routes require authentication
router.get('/', auth, getWallet);
router.get('/transactions', auth, getWalletTransactions);
router.get('/summary', auth, getWalletSummary);

module.exports = router;
