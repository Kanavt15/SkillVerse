/**
 * Notifications.
 *
 * `createNotification` keeps its original signature so existing call sites work
 * unchanged, and gains a `.bulk()` form for fan-out. The MySQL code notified an
 * instructor's followers with one INSERT per follower inside an unbounded
 * `forEach`, which on a popular instructor meant thousands of sequential round
 * trips fired off without backpressure.
 */

const Notification = require('../models/Notification');
const { emitToUser } = require('../socket');

/** Shape a notification document into the legacy response body. */
const toLegacy = (n) => ({
    id: String(n._id),
    _id: String(n._id),
    user_id: String(n.user),
    type: n.type,
    title: n.title,
    message: n.message,
    reference_id: n.referenceId ? String(n.referenceId) : null,
    referenceType: n.referenceType || null,
    is_read: n.isRead,
    isRead: n.isRead,
    created_at: n.createdAt,
});

/**
 * Create a notification and push it over the socket.
 *
 * Never throws: a notification failure must not roll back the action that
 * triggered it (finishing a course should not fail because the socket is down).
 */
const createNotification = async (userId, type, title, message, referenceId = null, referenceType = null) => {
    try {
        const notification = await Notification.create({
            user: userId,
            type,
            title,
            message,
            referenceId,
            referenceType,
        });

        const payload = toLegacy(notification);
        emitToUser(String(userId), 'new_notification', payload);
        return payload;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

/**
 * Create many notifications in one round trip, then emit to each recipient.
 * @param {Array<{user, type, title, message, referenceId?, referenceType?}>} items
 */
createNotification.bulk = async (items) => {
    if (!Array.isArray(items) || items.length === 0) return [];
    try {
        const docs = await Notification.insertMany(items, { ordered: false });
        docs.forEach((d) => {
            emitToUser(String(d.user), 'new_notification', toLegacy(d));
        });
        return docs;
    } catch (error) {
        console.error('Error creating notifications in bulk:', error);
        return [];
    }
};

// ------------------------------------------------------------------
// GET /api/notifications
// ------------------------------------------------------------------
const getNotifications = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

        const filter = { user: req.user.id };

        const [notifications, total] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Notification.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            notifications: notifications.map(toLegacy),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/notifications/unread-count
// ------------------------------------------------------------------
const getUnreadCount = async (req, res, next) => {
    try {
        const count = await Notification.countDocuments({
            user: req.user.id,
            isRead: false,
        });
        return res.json({ success: true, count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/notifications/:id/read
// ------------------------------------------------------------------
const markAsRead = async (req, res, next) => {
    try {
        // The user filter is the authorization check: it makes marking someone
        // else's notification a 404 rather than a silent success.
        const result = await Notification.updateOne(
            { _id: req.params.id, user: req.user.id },
            { $set: { isRead: true } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        return res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/notifications/read-all
// ------------------------------------------------------------------
const markAllAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { user: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );
        return res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return next(error);
    }
};

module.exports = {
    createNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
};
