const { pool } = require('../config/database');

// Get user wallet
const getWallet = async (req, res) => {
  try {
    const userId = req.user.id;

    const [wallet] = await pool.query(
      'SELECT * FROM wallets WHERE user_id = ?',
      [userId]
    );

    if (wallet.length === 0) {
      // Create wallet if doesn't exist
      await pool.query(
        'INSERT INTO wallets (user_id, balance) VALUES (?, 0)',
        [userId]
      );
      
      return res.json({
        success: true,
        wallet: {
          user_id: userId,
          balance: 0,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }

    res.json({
      success: true,
      wallet: wallet[0]
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wallet'
    });
  }
};

// Get wallet transactions
const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { transaction_type, source, status } = req.query;

    let query = `
      SELECT 
        wt.*,
        pp.name as package_name,
        c.title as course_title
      FROM wallet_transactions wt
      LEFT JOIN point_packages pp ON wt.package_id = pp.id
      LEFT JOIN courses c ON wt.course_id = c.id
      WHERE wt.user_id = ?
    `;
    
    const params = [userId];

    if (transaction_type) {
      query += ' AND wt.transaction_type = ?';
      params.push(transaction_type);
    }

    if (source) {
      query += ' AND wt.source = ?';
      params.push(source);
    }

    if (status) {
      query += ' AND wt.status = ?';
      params.push(status);
    }

    query += ' ORDER BY wt.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [transactions] = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = ?';
    const countParams = [userId];

    if (transaction_type) {
      countQuery += ' AND transaction_type = ?';
      countParams.push(transaction_type);
    }

    if (source) {
      countQuery += ' AND source = ?';
      countParams.push(source);
    }

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const [countResult] = await pool.query(countQuery, countParams);

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
    console.error('Get wallet transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
};

// Get wallet summary
const getWalletSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const [wallet] = await pool.query(
      'SELECT balance FROM wallets WHERE user_id = ?',
      [userId]
    );

    const [stats] = await pool.query(
      `SELECT 
        SUM(CASE WHEN transaction_type = 'credit' AND status = 'success' THEN amount ELSE 0 END) as total_credits,
        SUM(CASE WHEN transaction_type = 'debit' AND status = 'success' THEN amount ELSE 0 END) as total_debits,
        COUNT(CASE WHEN source = 'purchase' AND status = 'success' THEN 1 END) as total_purchases,
        COUNT(CASE WHEN source = 'enrollment' AND status = 'success' THEN 1 END) as total_enrollments
       FROM wallet_transactions
       WHERE user_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      summary: {
        current_balance: wallet[0]?.balance || 0,
        total_credits: stats[0].total_credits || 0,
        total_debits: stats[0].total_debits || 0,
        total_purchases: stats[0].total_purchases || 0,
        total_enrollments: stats[0].total_enrollments || 0
      }
    });
  } catch (error) {
    console.error('Get wallet summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wallet summary'
    });
  }
};

// Deduct points (for course enrollment)
const deductPoints = async (userId, courseId, amount, connection) => {
  try {
    // Get current balance with row lock
    const [wallet] = await connection.query(
      'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId]
    );

    if (wallet.length === 0) {
      throw new Error('Wallet not found');
    }

    const currentBalance = wallet[0].balance;

    if (currentBalance < amount) {
      throw new Error('Insufficient balance');
    }

    // Update wallet balance
    await connection.query(
      'UPDATE wallets SET balance = balance - ? WHERE user_id = ?',
      [amount, userId]
    );

    // Create debit transaction
    await connection.query(
      `INSERT INTO wallet_transactions 
       (user_id, transaction_type, amount, balance_before, balance_after, 
        source, status, course_id)
       VALUES (?, 'debit', ?, ?, ?, 'enrollment', 'success', ?)`,
      [userId, amount, currentBalance, currentBalance - amount, courseId]
    );

    return {
      success: true,
      new_balance: currentBalance - amount
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getWallet,
  getWalletTransactions,
  getWalletSummary,
  deductPoints
};
