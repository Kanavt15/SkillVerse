const express = require('express');
const User = require('../models/User');
const serialize = require('../serializers');
const { validate, objectIdParam } = require('../middleware/validate.middleware');

const router = express.Router();

// @route   GET /api/users/:id
// @desc    Get a user's public profile
// @access  Public
//
// SECURITY: the MySQL version selected `email` and `points` and returned the
// row verbatim on a PUBLIC route, so anyone could enumerate every user's email
// address and wallet balance. The public serializer exposes only display
// fields.
router.get(
    '/:id',
    [objectIdParam('id')],
    validate,
    async (req, res, next) => {
        try {
            const user = await User.findById(req.params.id);

            if (!user || user.isSuspended) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            return res.json({ success: true, user: serialize.publicUser(user) });
        } catch (error) {
            console.error('Get user error:', error);
            return next(error);
        }
    }
);

module.exports = router;
