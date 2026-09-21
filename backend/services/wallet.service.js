/**
 * Unified wallet service — the single place credits move.
 *
 * WHY THIS EXISTS
 *
 * MySQL had two independent currencies that both called themselves "points":
 *
 *   users.points   + point_transactions   <- welcome bonus, course rewards
 *                                            spent on: streak freezes
 *   wallets.balance + wallet_transactions <- Razorpay purchases
 *                                            spent on: course enrollment
 *
 * So a learner who completed a course was credited in a currency they could not
 * enroll with, and instructor revenue — computed from point_transactions, which
 * enrollment never wrote to — was structurally always zero.
 *
 * Everything now moves through User.wallet.balance and one WalletTransaction
 * ledger, and every mutation goes through this module so no caller can write a
 * balance without a matching ledger row.
 *
 * ATOMICITY
 *
 * `debit` is a single conditional update rather than the read-then-write the
 * SQL used (SELECT ... FOR UPDATE, then UPDATE). Matching on
 * `wallet.balance >= amount` inside the same operation that decrements it means
 * two concurrent enrollments cannot both observe a sufficient balance and both
 * succeed — no row lock required, and correct even outside a transaction.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

const toObjectId = (v) => new mongoose.Types.ObjectId(String(v));

/** Thrown when a debit would take the balance negative. */
class InsufficientBalanceError extends Error {
    constructor(required, available) {
        super('Insufficient balance');
        this.name = 'InsufficientBalanceError';
        this.status = 400;
        this.required = required;
        this.available = available;
    }
}

/**
 * Move credits OUT of a user's wallet.
 *
 * @param {string} userId
 * @param {object} opts - { amount, source, description?, course?, metadata? }
 * @param {import('mongoose').ClientSession} [session]
 * @returns {Promise<{balance: number, transaction: object}>}
 */
async function debit(userId, opts, session = null) {
    const { amount, source, description = '', course = null, metadata = {} } = opts;

    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error(`debit: amount must be a positive integer, got ${amount}`);
    }

    // Atomic guard + decrement. If the balance is too low nothing matches and
    // nothing is written.
    const updated = await User.findOneAndUpdate(
        { _id: userId, 'wallet.balance': { $gte: amount } },
        { $inc: { 'wallet.balance': -amount, 'wallet.totalSpent': amount } },
        { new: true, session }
    ).select('wallet');

    if (!updated) {
        const current = await User.findById(userId).select('wallet').session(session);
        if (!current) throw new Error('User not found');
        throw new InsufficientBalanceError(amount, current.wallet.balance);
    }

    const [transaction] = await WalletTransaction.create([{
        user: userId,
        type: 'debit',
        amount,
        source,
        balanceAfter: updated.wallet.balance,
        description,
        course,
        status: 'success',
        metadata,
    }], { session });

    return { balance: updated.wallet.balance, transaction };
}

/**
 * Move credits INTO a user's wallet.
 *
 * @param {string} userId
 * @param {object} opts - { amount, source, description?, course?, package?,
 *                          razorpayOrderId?, razorpayPaymentId?, metadata? }
 * @param {import('mongoose').ClientSession} [session]
 */
async function credit(userId, opts, session = null) {
    const {
        amount, source, description = '', course = null,
        package: pkg = null, razorpayOrderId = null, razorpayPaymentId = null,
        metadata = {},
    } = opts;

    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error(`credit: amount must be a positive integer, got ${amount}`);
    }

    const updated = await User.findByIdAndUpdate(
        userId,
        { $inc: { 'wallet.balance': amount, 'wallet.totalEarned': amount } },
        { new: true, session }
    ).select('wallet');

    if (!updated) throw new Error('User not found');

    const [transaction] = await WalletTransaction.create([{
        user: userId,
        type: 'credit',
        amount,
        source,
        balanceAfter: updated.wallet.balance,
        description,
        course,
        package: pkg,
        razorpayOrderId,
        razorpayPaymentId,
        status: 'success',
        metadata,
    }], { session });

    return { balance: updated.wallet.balance, transaction };
}

/**
 * Current balance, read straight off the user document.
 */
async function getBalance(userId) {
    const user = await User.findById(userId).select('wallet').lean();
    return user?.wallet?.balance ?? 0;
}

/**
 * Aggregate ledger totals for the wallet summary screen.
 * Replaces four SUM/COUNT(CASE WHEN ...) expressions in one SELECT.
 */
async function getSummary(userId) {
    const [user, stats] = await Promise.all([
        User.findById(userId).select('wallet').lean(),
        WalletTransaction.aggregate([
            { $match: { user: toObjectId(userId), status: 'success' } },
            {
                $group: {
                    _id: null,
                    totalCredits: {
                        $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] },
                    },
                    totalDebits: {
                        $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] },
                    },
                    totalPurchases: {
                        $sum: { $cond: [{ $eq: ['$source', 'purchase'] }, 1, 0] },
                    },
                    totalEnrollments: {
                        $sum: { $cond: [{ $eq: ['$source', 'enrollment'] }, 1, 0] },
                    },
                },
            },
        ]),
    ]);

    const s = stats[0] || {};
    return {
        current_balance: user?.wallet?.balance ?? 0,
        total_credits: s.totalCredits || 0,
        total_debits: s.totalDebits || 0,
        total_purchases: s.totalPurchases || 0,
        total_enrollments: s.totalEnrollments || 0,
    };
}

module.exports = {
    debit,
    credit,
    getBalance,
    getSummary,
    InsufficientBalanceError,
};
