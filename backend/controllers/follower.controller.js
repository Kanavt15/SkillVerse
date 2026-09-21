/**
 * Follows.
 *
 * `followerId === followingId` used to compare two integers; with ObjectIds
 * that comparison is between a JWT string and a route-param string, so it is
 * done with String() on both sides rather than relying on identity.
 */

const Follow = require('../models/Follow');
const User = require('../models/User');
const serialize = require('../serializers');
const { createNotification } = require('./notification.controller');

/** A followed/following entry in the legacy shape. */
const toLegacy = (user, followedAt) => ({
    ...serialize.publicUser(user),
    followed_at: followedAt,
});

// ------------------------------------------------------------------
// POST /api/followers/:userId
// ------------------------------------------------------------------
const followUser = async (req, res, next) => {
    try {
        const followerId = String(req.user.id);
        const followingId = String(req.params.userId);

        if (followerId === followingId) {
            return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
        }

        const target = await User.findById(followingId).select('fullName isSuspended');
        if (!target || target.isSuspended) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        try {
            await Follow.create({ follower: followerId, following: followingId });
        } catch (err) {
            // The unique index makes the duplicate check race-proof.
            if (err.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: 'Already following this user',
                });
            }
            throw err;
        }

        const follower = await User.findById(followerId).select('fullName').lean();
        await createNotification(
            followingId,
            'follower',
            'New Follower',
            `${follower?.fullName || 'Someone'} started following you!`,
            followerId,
            'user'
        );

        return res.status(201).json({ success: true, message: 'Successfully followed user' });
    } catch (error) {
        console.error('Error following user:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// DELETE /api/followers/:userId
// ------------------------------------------------------------------
const unfollowUser = async (req, res, next) => {
    try {
        const result = await Follow.deleteOne({
            follower: req.user.id,
            following: req.params.userId,
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Not following this user' });
        }

        return res.json({ success: true, message: 'Successfully unfollowed user' });
    } catch (error) {
        console.error('Error unfollowing user:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/followers/:userId/followers
// ------------------------------------------------------------------
const getFollowers = async (req, res, next) => {
    try {
        const rows = await Follow.find({ following: req.params.userId })
            .sort({ createdAt: -1 })
            .populate('follower', 'fullName username profileImage teaching xp level bio createdAt')
            .lean();

        const followers = rows
            .filter((r) => r.follower)
            .map((r) => toLegacy(r.follower, r.createdAt));

        return res.json({ success: true, followers, count: followers.length });
    } catch (error) {
        console.error('Error fetching followers:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/followers/:userId/following
// ------------------------------------------------------------------
const getFollowing = async (req, res, next) => {
    try {
        const rows = await Follow.find({ follower: req.params.userId })
            .sort({ createdAt: -1 })
            .populate('following', 'fullName username profileImage teaching xp level bio createdAt')
            .lean();

        const following = rows
            .filter((r) => r.following)
            .map((r) => toLegacy(r.following, r.createdAt));

        return res.json({ success: true, following, count: following.length });
    } catch (error) {
        console.error('Error fetching following:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/followers/:userId/is-following
// ------------------------------------------------------------------
const isFollowing = async (req, res, next) => {
    try {
        const exists = await Follow.exists({
            follower: req.user.id,
            following: req.params.userId,
        });
        return res.json({ success: true, isFollowing: Boolean(exists) });
    } catch (error) {
        console.error('Error checking follow status:', error);
        return next(error);
    }
};

module.exports = {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    isFollowing,
};
