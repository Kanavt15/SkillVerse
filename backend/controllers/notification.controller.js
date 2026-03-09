const { pool } = require('../config/database');
const { emitToUser } = require('../socket');

/**
 * Internal helper — create a notification and push it via WebSocket.
 * Not exposed as an API endpoint.
 */
const createNotification = async (userId, type, title, message, referenceId = null) => {
    try {
        const [result] = await pool.query(
            'INSERT INTO notifications (user_id, type, title, message, reference_id) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, message, referenceId]
        );

        const notification = {
            id: result.insertId,
            user_id: userId,
            type,
            title,
            message,
            reference_id: referenceId,
            is_read: false,
            created_at: new Date().toISOString()
        };

        // Push real-time notification via WebSocket
        emitToUser(userId, 'new_notification', notification);

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        // Don't throw — notification failure shouldn't break the parent operation
        return null;
    }
};

/**
 * GET /api/notifications?page=1&limit=10
 * Paginated list of notifications for the authenticated user.
 */
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;

        const [notifications] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [userId, limit, offset]
        );

        const [[{ total }]] = await pool.query(
            'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
            [userId]
        );

        res.json({
            success: true,
            notifications,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Error fetching notifications' });
    }
};

/**
 * GET /api/notifications/unread-count
 * Returns the number of unread notifications.
 */
const getUnreadCount = async (req, res) => {
    try {
        const [[{ count }]] = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [req.user.id]
        );

        res.json({ success: true, count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ success: false, message: 'Error fetching unread count' });
    }
};

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read.
 */
const markAsRead = async (req, res) => {
    try {
        const [result] = await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, message: 'Error updating notification' });
    }
};

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read for the authenticated user.
 */
const markAllAsRead = async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [req.user.id]
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ success: false, message: 'Error updating notifications' });
    }
};

module.exports = {
    createNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
};
