const { pool } = require('../config/database');
const { createNotification } = require('./notification.controller');

/**
 * POST /api/followers/:userId
 * Follow a user. Triggers a 'follower' notification.
 */
const followUser = async (req, res) => {
    try {
        const followerId = req.user.id;
        const followingId = parseInt(req.params.userId);

        if (followerId === followingId) {
            return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
        }

        // Verify target user exists
        const [users] = await pool.query('SELECT id, full_name FROM users WHERE id = ?', [followingId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if already following
        const [existing] = await pool.query(
            'SELECT id FROM followers WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId]
        );

        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Already following this user' });
        }

        await pool.query(
            'INSERT INTO followers (follower_id, following_id) VALUES (?, ?)',
            [followerId, followingId]
        );

        // Get follower's name for the notification
        const [followerUser] = await pool.query('SELECT full_name FROM users WHERE id = ?', [followerId]);
        const followerName = followerUser[0]?.full_name || 'Someone';

        // Create notification for the followed user
        await createNotification(
            followingId,
            'follower',
            'New Follower',
            `${followerName} started following you!`,
            followerId
        );

        res.status(201).json({ success: true, message: 'Successfully followed user' });
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({ success: false, message: 'Error following user' });
    }
};

/**
 * DELETE /api/followers/:userId
 * Unfollow a user.
 */
const unfollowUser = async (req, res) => {
    try {
        const followerId = req.user.id;
        const followingId = parseInt(req.params.userId);

        const [result] = await pool.query(
            'DELETE FROM followers WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Not following this user' });
        }

        res.json({ success: true, message: 'Successfully unfollowed user' });
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.status(500).json({ success: false, message: 'Error unfollowing user' });
    }
};

/**
 * GET /api/followers/:userId/followers
 * List followers for a user.
 */
const getFollowers = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const [followers] = await pool.query(
            `SELECT u.id, u.full_name, u.profile_image, u.role, f.created_at as followed_at
       FROM followers f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ?
       ORDER BY f.created_at DESC`,
            [userId]
        );

        res.json({ success: true, followers, count: followers.length });
    } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ success: false, message: 'Error fetching followers' });
    }
};

/**
 * GET /api/followers/:userId/following
 * List who a user is following.
 */
const getFollowing = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const [following] = await pool.query(
            `SELECT u.id, u.full_name, u.profile_image, u.role, f.created_at as followed_at
       FROM followers f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ?
       ORDER BY f.created_at DESC`,
            [userId]
        );

        res.json({ success: true, following, count: following.length });
    } catch (error) {
        console.error('Error fetching following:', error);
        res.status(500).json({ success: false, message: 'Error fetching following' });
    }
};

/**
 * GET /api/followers/:userId/is-following
 * Check if the current user follows a target user.
 */
const isFollowing = async (req, res) => {
    try {
        const followerId = req.user.id;
        const followingId = parseInt(req.params.userId);

        const [rows] = await pool.query(
            'SELECT id FROM followers WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId]
        );

        res.json({ success: true, isFollowing: rows.length > 0 });
    } catch (error) {
        console.error('Error checking follow status:', error);
        res.status(500).json({ success: false, message: 'Error checking follow status' });
    }
};

module.exports = {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    isFollowing
};
