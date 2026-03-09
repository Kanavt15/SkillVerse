const express = require('express');
const { param, query } = require('express-validator');
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
} = require('../controllers/notification.controller');
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

// @route   GET /api/notifications
// @desc    Get paginated notifications for the authenticated user
// @access  Private
router.get('/',
    auth,
    [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
    ],
    validate,
    getNotifications
);

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count
// @access  Private
router.get('/unread-count', auth, getUnreadCount);

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', auth, markAllAsRead);

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.put('/:id/read',
    auth,
    [param('id').isInt({ min: 1 }).withMessage('Valid notification ID is required')],
    validate,
    markAsRead
);

module.exports = router;
