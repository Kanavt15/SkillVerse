/**
 * WalletTransaction — the single, unified currency ledger.
 *
 * Replaces BOTH `point_transactions` and `wallet_transactions`. Under MySQL
 * these were two independent currencies that disagreed:
 *
 *   - enrollment DEBITED wallets.balance
 *   - course completion CREDITED users.points
 *   - streak freezes DEBITED users.points
 *   - Razorpay purchases CREDITED wallets.balance
 *
 * so rewards a learner earned could never be spent on a course, and instructor
 * revenue — computed from point_transactions, which enrollment never wrote to —
 * was structurally always zero. One ledger against User.wallet.balance makes
 * every balance question answerable from one place.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const walletTransactionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true, min: 0 },

    source: {
        type: String,
        enum: [
            'purchase',           // bought credits with real money
            'enrollment',         // spent on a course
            'reward',             // earned by completing a course
            'welcome_bonus',      // granted at registration
            'refund',
            'streak_freeze',      // spent on a freeze
            'admin_adjustment',
        ],
        required: true,
        index: true,
    },

    // Balance after this entry was applied — makes the ledger auditable without
    // replaying every prior row.
    balanceAfter: { type: Number, required: true, min: 0 },

    description: { type: String, default: '', maxlength: 255 },

    course: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
    package: { type: Schema.Types.ObjectId, ref: 'PointPackage', default: null },

    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'cancelled'],
        default: 'success',
    },

    // Razorpay identifiers. `razorpayPaymentId` is the ONLY thing standing
    // between a retried webhook and a double credit — the unique index is a
    // correctness requirement, not an optimization.
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null, select: false },

    metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// PARTIAL, not sparse. A sparse index only skips documents where the field is
// absent — and this field defaults to null, so every non-Razorpay transaction
// would index as null and the second one would collide. Restricting the index
// to documents where it is actually a string means only real payment ids are
// constrained, which is what prevents a retried webhook double-crediting.
walletTransactionSchema.index(
    { razorpayPaymentId: 1 },
    { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
);
walletTransactionSchema.index({ user: 1, createdAt: -1 });
// Instructor revenue: debits with source 'enrollment' against their courses.
walletTransactionSchema.index({ course: 1, source: 1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
