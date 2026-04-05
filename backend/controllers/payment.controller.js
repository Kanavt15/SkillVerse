const Razorpay = require('razorpay');
const crypto = require('crypto');
const { pool } = require('../config/database');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Get all point packages
const getPointPackages = async (req, res) => {
  try {
    const [packages] = await pool.query(
      'SELECT * FROM point_packages WHERE is_active = TRUE ORDER BY display_order, price ASC'
    );

    res.json({
      success: true,
      count: packages.length,
      packages
    });
  } catch (error) {
    console.error('Get point packages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching point packages'
    });
  }
};

// Create Razorpay order
const createOrder = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { package_id } = req.body;
    const userId = req.user.id;

    // Validate package
    const [packages] = await connection.query(
      'SELECT * FROM point_packages WHERE id = ? AND is_active = TRUE',
      [package_id]
    );

    if (packages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package selected'
      });
    }

    const selectedPackage = packages[0];
    const totalPoints = selectedPackage.points + selectedPackage.bonus_points;
    const amountInPaise = Math.round(selectedPackage.price * 100);

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `order_${userId}_${Date.now()}`,
      notes: {
        user_id: userId,
        package_id: package_id,
        points: totalPoints
      }
    });

    // Get current wallet balance
    const [wallet] = await connection.query(
      'SELECT balance FROM wallets WHERE user_id = ?',
      [userId]
    );

    const currentBalance = wallet[0]?.balance || 0;

    // Create pending transaction
    await connection.query(
      `INSERT INTO wallet_transactions 
       (user_id, transaction_type, amount, balance_before, balance_after, 
        source, status, razorpay_order_id, package_id, metadata)
       VALUES (?, 'credit', ?, ?, ?, 'purchase', 'pending', ?, ?, ?)`,
      [
        userId,
        totalPoints,
        currentBalance,
        currentBalance,
        razorpayOrder.id,
        package_id,
        JSON.stringify({
          package_name: selectedPackage.name,
          base_points: selectedPackage.points,
          bonus_points: selectedPackage.bonus_points,
          price: selectedPackage.price
        })
      ]
    );

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        points: totalPoints,
        package: selectedPackage
      },
      razorpay_key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment order'
    });
  } finally {
    connection.release();
  }
};

// Verify payment and credit points
const verifyPayment = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    const userId = req.user.id;

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    await connection.beginTransaction();

    // Check if payment already processed (idempotency)
    const [existing] = await connection.query(
      'SELECT id, status FROM wallet_transactions WHERE razorpay_payment_id = ?',
      [razorpay_payment_id]
    );

    if (existing.length > 0) {
      if (existing[0].status === 'success') {
        await connection.commit();
        return res.json({
          success: true,
          message: 'Payment already processed',
          already_processed: true
        });
      }
    }

    // Get pending transaction
    const [transactions] = await connection.query(
      'SELECT * FROM wallet_transactions WHERE razorpay_order_id = ? AND user_id = ? AND status = "pending"',
      [razorpay_order_id, userId]
    );

    if (transactions.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const transaction = transactions[0];

    // Update transaction
    await connection.query(
      `UPDATE wallet_transactions 
       SET status = 'success', 
           razorpay_payment_id = ?, 
           razorpay_signature = ?,
           balance_after = balance_before + amount,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [razorpay_payment_id, razorpay_signature, transaction.id]
    );

    // Update wallet balance
    await connection.query(
      'UPDATE wallets SET balance = balance + ? WHERE user_id = ?',
      [transaction.amount, userId]
    );

    // Get updated balance
    const [updatedWallet] = await connection.query(
      'SELECT balance FROM wallets WHERE user_id = ?',
      [userId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Payment verified and points credited successfully',
      points_credited: transaction.amount,
      new_balance: updatedWallet[0].balance
    });

  } catch (error) {
    await connection.rollback();
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment'
    });
  } finally {
    connection.release();
  }
};

// Razorpay webhook handler
const handleWebhook = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload.payment.entity;

    if (event === 'payment.captured') {
      const orderId = payload.order_id;
      const paymentId = payload.id;

      await connection.beginTransaction();

      // Check if already processed
      const [existing] = await connection.query(
        'SELECT id, status FROM wallet_transactions WHERE razorpay_payment_id = ?',
        [paymentId]
      );

      if (existing.length > 0 && existing[0].status === 'success') {
        await connection.commit();
        return res.json({ success: true, message: 'Already processed' });
      }

      // Get pending transaction
      const [transactions] = await connection.query(
        'SELECT * FROM wallet_transactions WHERE razorpay_order_id = ? AND status = "pending"',
        [orderId]
      );

      if (transactions.length === 0) {
        await connection.rollback();
        return res.json({ success: false, message: 'Transaction not found' });
      }

      const transaction = transactions[0];

      // Update transaction
      await connection.query(
        `UPDATE wallet_transactions 
         SET status = 'success', 
             razorpay_payment_id = ?,
             balance_after = balance_before + amount,
             metadata = JSON_SET(COALESCE(metadata, '{}'), '$.webhook_processed', TRUE),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [paymentId, transaction.id]
      );

      // Update wallet balance
      await connection.query(
        'UPDATE wallets SET balance = balance + ? WHERE user_id = ?',
        [transaction.amount, transaction.user_id]
      );

      await connection.commit();

      console.log(`Webhook processed: Payment ${paymentId} - ${transaction.amount} points credited to user ${transaction.user_id}`);
    }

    res.json({ success: true });

  } catch (error) {
    await connection.rollback();
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  } finally {
    connection.release();
  }
};

// Get payment history
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [transactions] = await pool.query(
      `SELECT 
        wt.*,
        pp.name as package_name
       FROM wallet_transactions wt
       LEFT JOIN point_packages pp ON wt.package_id = pp.id
       WHERE wt.user_id = ? AND wt.source = 'purchase'
       ORDER BY wt.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = ? AND source = "purchase"',
      [userId]
    );

    res.json({
      success: true,
      count: transactions.length,
      transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(countResult[0].total / limit),
        totalTransactions: countResult[0].total,
        limit
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment history'
    });
  }
};

module.exports = {
  getPointPackages,
  createOrder,
  verifyPayment,
  handleWebhook,
  getPaymentHistory
};
