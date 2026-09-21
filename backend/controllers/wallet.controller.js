/**
 * Wallet endpoints.
 *
 * The `wallets` table is gone — the balance lives on the user document, so
 * there is no lazy "create wallet if missing" path any more and no need for the
 * AFTER INSERT trigger that used to create one.
 *
 * All balance mutation lives in services/wallet.service.js.
 */

const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const walletService = require('../services/wallet.service');

/** Ledger row -> legacy response shape. */
const toLegacy = (t) => ({
    id: String(t._id),
    _id: String(t._id),
    user_id: String(t.user),
    // The old column was `transaction_type`.
    transaction_type: t.type,
    type: t.type,
    amount: t.amount,
    balance_after: t.balanceAfter,
    balanceAfter: t.balanceAfter,
    source: t.source,
    status: t.status,
    description: t.description || '',
    course_id: t.course ? String(t.course._id || t.course) : null,
    course_title: t.course && t.course.title ? t.course.title : null,
    package_id: t.package ? String(t.package._id || t.package) : null,
    package_name: t.package && t.package.name ? t.package.name : null,
    razorpay_payment_id: t.razorpayPaymentId || null,
    created_at: t.createdAt,
});

// ------------------------------------------------------------------
// GET /api/wallet
// ------------------------------------------------------------------
const getWallet = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('wallet createdAt updatedAt').lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.json({
            success: true,
            wallet: {
                user_id: String(req.user.id),
                balance: user.wallet?.balance ?? 0,
                total_earned: user.wallet?.totalEarned ?? 0,
                total_spent: user.wallet?.totalSpent ?? 0,
                created_at: user.createdAt,
                updated_at: user.updatedAt,
            },
        });
    } catch (error) {
        console.error('Get wallet error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/wallet/transactions
// ------------------------------------------------------------------
const getWalletTransactions = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

        const filter = { user: req.user.id };
        // `transaction_type` is the legacy query param name.
        const type = req.query.transaction_type || req.query.type;
        if (type) filter.type = type;
        if (req.query.source) filter.source = req.query.source;
        if (req.query.status) filter.status = req.query.status;

        const [transactions, total] = await Promise.all([
            WalletTransaction.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('course', 'title')
                .populate('package', 'name')
                .lean(),
            WalletTransaction.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            count: transactions.length,
            transactions: transactions.map(toLegacy),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalTransactions: total,
                limit,
            },
        });
    } catch (error) {
        console.error('Get wallet transactions error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/wallet/summary
// ------------------------------------------------------------------
const getWalletSummary = async (req, res, next) => {
    try {
        const summary = await walletService.getSummary(req.user.id);
        return res.json({ success: true, summary });
    } catch (error) {
        console.error('Get wallet summary error:', error);
        return next(error);
    }
};

/**
 * Spend credits on a course enrollment.
 *
 * Kept as a named export because enrollment calls it. It now delegates to the
 * wallet service, whose conditional update replaces the SELECT ... FOR UPDATE
 * the SQL version needed to make the check-then-decrement safe.
 */
const deductPoints = async (userId, courseId, amount, session = null) => {
    const { balance } = await walletService.debit(userId, {
        amount,
        source: 'enrollment',
        description: 'Course enrollment',
        course: courseId,
    }, session);

    return { success: true, new_balance: balance };
};

module.exports = {
    getWallet,
    getWalletTransactions,
    getWalletSummary,
    deductPoints,
    toLegacy,
};
