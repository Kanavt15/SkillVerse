const express = require('express');
const { param } = require('express-validator');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth.middleware');
const { validationResult } = require('express-validator');

const router = express.Router();

// @route   GET /api/users/:id
// @desc    Get user profile by ID
// @access  Public
router.get('/:id',
  [param('id').isInt({ min: 1 }).withMessage('Valid user ID is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const [users] = await pool.query(
        'SELECT id, email, full_name, role, bio, profile_image, points, created_at FROM users WHERE id = ?',
        [req.params.id]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user: users[0]
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user'
      });
    }
  }
);

module.exports = router;
