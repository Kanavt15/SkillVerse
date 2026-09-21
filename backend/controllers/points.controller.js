/**
 * Points endpoints — now a thin alias over the unified wallet.
 *
 * `users.points` and `point_transactions` no longer exist. The frontend still
 * calls GET /api/points and GET /api/points/transactions (the navbar balance
 * pill and the profile history list), so those routes keep working and simply
 * read the one real balance instead of the second, divergent one.
 *
 * The response shape is preserved, including the `transaction_type` naming that
 * `Profile.jsx` switches on ('earned' | 'spent' | 'bonus').
 */

const WalletTransaction = require('../models/WalletTransaction');
const walletService = require('../services/wallet.service');

/**
 * Map a ledger entry onto the three transaction types the old points history
 * UI knows how to render.
 */
const toPointsLegacy = (t) => {
    let transactionType;
    if (t.source === 'welcome_bonus') {
        transactionType = 'bonus';
    } else if (t.type === 'credit') {
        transactionType = 'earned';
    } else {
        transactionType = 'spent';
    }

    return {
        id: String(t._id),
        _id: String(t._id),
        user_id: String(t.user),
        amount: t.amount,
        type: transactionType,
        transaction_type: transactionType,
        source: t.source,
        description: t.description || '',
        balance_after: t.balanceAfter,
        created_at: t.createdAt,
    };
};

// ------------------------------------------------------------------
// GET /api/points
// ------------------------------------------------------------------
const getBalance = async (req, res, next) => {
    try {
        const points = await walletService.getBalance(req.user.id);
        return res.json({ success: true, points });
    } catch (error) {
        console.error('Get balance error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/points/transactions
// ------------------------------------------------------------------
const getTransactions = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

        const filter = { user: req.user.id };

        const [transactions, total] = await Promise.all([
            WalletTransaction.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            WalletTransaction.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            transactions: transactions.map(toPointsLegacy),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        return next(error);
    }
};

module.exports = {
    getBalance,
    getTransactions,
    toPointsLegacy,
};
