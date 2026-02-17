const { pool } = require('../config/database');

// Get user's points balance
const getBalance = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT points FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      points: users[0].points
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching points balance'
    });
  }
};

// Get user's point transaction history
const getTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [transactions] = await pool.query(
      `SELECT * FROM point_transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM point_transactions WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
};

module.exports = {
  getBalance,
  getTransactions
};
