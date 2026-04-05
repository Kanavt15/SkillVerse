const express = require('express');
const router = express.Router();
const {
  getPointPackages,
  createOrder,
  verifyPayment,
  handleWebhook,
  getPaymentHistory
} = require('../controllers/payment.controller');
const { auth } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');

// Rate limiter for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many payment requests, please try again later'
});

// Public routes
router.get('/packages', getPointPackages);

// Protected routes
router.post('/create-order', auth, paymentLimiter, createOrder);
router.post('/verify', auth, verifyPayment);
router.get('/history', auth, getPaymentHistory);

// Webhook route (no auth - verified by signature)
router.post('/webhook', handleWebhook);

module.exports = router;
