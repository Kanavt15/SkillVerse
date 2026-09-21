/**
 * Razorpay credit purchases.
 *
 * Changes from the MySQL version:
 *
 *   - The client is built lazily. It used to be constructed at module load and
 *     the SDK throws when `key_id` is missing, so an install without payment
 *     credentials could not start the server AT ALL.
 *
 *   - `createOrder` acquired a DB connection but never opened a transaction,
 *     spanning an external API call with no rollback. It now writes only the
 *     single pending ledger row, after the order succeeds.
 *
 *   - Crediting is idempotent through the unique partial index on
 *     `razorpayPaymentId`. A retried webhook and a racing client-side verify
 *     cannot both credit the same payment.
 *
 *   - Money is integer paise throughout. `price * 100` on a DECIMAL was doing
 *     float arithmetic on currency.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');

const PointPackage = require('../models/PointPackage');
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const walletService = require('../services/wallet.service');
const { createNotification } = require('./notification.controller');

let razorpayClient = null;

const isPaymentsConfigured = () => Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
);

const getRazorpay = () => {
    if (!isPaymentsConfigured()) {
        const err = new Error('Payments are not configured on this server.');
        err.status = 503;
        throw err;
    }
    if (!razorpayClient) {
        razorpayClient = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpayClient;
};

const packageToLegacy = (p) => ({
    id: String(p._id),
    _id: String(p._id),
    name: p.name,
    description: p.description || '',
    points: p.points,
    bonus_points: p.bonusPoints || 0,
    // Legacy clients expect rupees; the stored value is paise.
    price: (p.priceInPaise || 0) / 100,
    price_in_paise: p.priceInPaise || 0,
    is_active: p.isActive,
    display_order: p.order || 0,
});

// ------------------------------------------------------------------
// GET /api/payments/packages
// ------------------------------------------------------------------
const getPointPackages = async (req, res, next) => {
    try {
        const packages = await PointPackage.find({ isActive: true })
            .sort({ order: 1, priceInPaise: 1 })
            .lean();

        return res.json({
            success: true,
            count: packages.length,
            packages: packages.map(packageToLegacy),
            payments_enabled: isPaymentsConfigured(),
        });
    } catch (error) {
        console.error('Get packages error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/payments/create-order
// ------------------------------------------------------------------
const createOrder = async (req, res, next) => {
    try {
        const pkg = await PointPackage.findOne({
            _id: req.body.package_id,
            isActive: true,
        });

        if (!pkg) {
            return res.status(400).json({ success: false, message: 'Invalid package selected' });
        }

        const totalPoints = pkg.points + (pkg.bonusPoints || 0);
        const userId = req.user.id;

        const order = await getRazorpay().orders.create({
            amount: pkg.priceInPaise,
            currency: 'INR',
            receipt: `order_${userId}_${Date.now()}`,
            notes: {
                user_id: String(userId),
                package_id: String(pkg._id),
                points: String(totalPoints),
            },
        });

        const balance = await walletService.getBalance(userId);

        // Pending row only. No balance moves until the payment is verified.
        await WalletTransaction.create({
            user: userId,
            type: 'credit',
            amount: totalPoints,
            source: 'purchase',
            balanceAfter: balance,
            status: 'pending',
            razorpayOrderId: order.id,
            package: pkg._id,
            description: `Purchase: ${pkg.name}`,
            metadata: {
                package_name: pkg.name,
                base_points: pkg.points,
                bonus_points: pkg.bonusPoints || 0,
                price_in_paise: pkg.priceInPaise,
            },
        });

        return res.json({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
                points: totalPoints,
                package: packageToLegacy(pkg),
            },
            razorpay_key: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        if (error.status === 503) {
            return res.status(503).json({ success: false, message: error.message });
        }
        console.error('Create order error:', error);
        return next(error);
    }
};

/**
 * Credit a verified payment exactly once.
 *
 * Shared by the client-side verify call and the webhook, which can arrive in
 * either order or both. The pending row is claimed with a conditional update:
 * whichever path matches `status: 'pending'` first does the crediting, and the
 * other sees zero matches and stops.
 */
async function settlePayment({ orderId, paymentId, signature }) {
    const claimed = await WalletTransaction.findOneAndUpdate(
        { razorpayOrderId: orderId, status: 'pending' },
        { $set: { status: 'success', razorpayPaymentId: paymentId, razorpaySignature: signature } },
        { new: true }
    );

    if (!claimed) {
        // Already settled (or unknown order) — not an error for a retry.
        const existing = await WalletTransaction.findOne({ razorpayOrderId: orderId }).lean();
        return { alreadySettled: Boolean(existing), transaction: existing };
    }

    const { balance } = await walletService.credit(claimed.user, {
        amount: claimed.amount,
        source: 'purchase',
        description: claimed.description,
        package: claimed.package,
    });

    // The credit writes its own ledger row; this pending one is the receipt.
    await WalletTransaction.updateOne(
        { _id: claimed._id },
        { $set: { balanceAfter: balance } }
    );

    createNotification(
        claimed.user,
        'enrollment',
        'Credits Added',
        `${claimed.amount} credits have been added to your wallet.`,
        null,
        'wallet'
    ).catch(() => {});

    return { alreadySettled: false, transaction: claimed, balance };
}

// ------------------------------------------------------------------
// POST /api/payments/verify
// ------------------------------------------------------------------
const verifyPayment = async (req, res, next) => {
    try {
        const {
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
        } = req.body;

        if (!orderId || !paymentId || !signature) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }
        if (!isPaymentsConfigured()) {
            return res.status(503).json({ success: false, message: 'Payments are not configured on this server.' });
        }

        const expected = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        // Constant-time compare: a plain !== leaks signature bytes by timing.
        const provided = Buffer.from(String(signature));
        const expectedBuf = Buffer.from(expected);
        const valid = provided.length === expectedBuf.length
            && crypto.timingSafeEqual(provided, expectedBuf);

        if (!valid) {
            if (req.logSecurity) {
                req.logSecurity('SUSPICIOUS', { reason: 'bad_payment_signature', orderId });
            }
            await WalletTransaction.updateOne(
                { razorpayOrderId: orderId, status: 'pending' },
                { $set: { status: 'failed' } }
            );
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        const result = await settlePayment({ orderId, paymentId, signature });

        const balance = result.balance ?? await walletService.getBalance(req.user.id);

        return res.json({
            success: true,
            message: result.alreadySettled ? 'Payment already processed' : 'Payment verified and credits added',
            wallet_balance: balance,
            points_added: result.alreadySettled ? 0 : result.transaction?.amount || 0,
        });
    } catch (error) {
        console.error('Verify payment error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/payments/webhook
// ------------------------------------------------------------------
const handleWebhook = async (req, res, next) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            return res.status(503).json({ success: false, message: 'Webhooks are not configured.' });
        }

        const provided = String(req.headers['x-razorpay-signature'] || '');
        const expected = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            if (req.logSecurity) req.logSecurity('SUSPICIOUS', { reason: 'bad_webhook_signature' });
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        const event = req.body.event;
        const entity = req.body.payload?.payment?.entity;

        if (event === 'payment.captured' && entity) {
            await settlePayment({
                orderId: entity.order_id,
                paymentId: entity.id,
                signature: provided,
            });
        } else if (event === 'payment.failed' && entity) {
            await WalletTransaction.updateOne(
                { razorpayOrderId: entity.order_id, status: 'pending' },
                { $set: { status: 'failed' } }
            );
        }

        // Always 200 on a valid signature — a non-2xx makes Razorpay retry,
        // and an unrecognised event is not a failure.
        return res.json({ success: true, received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/payments/history
// ------------------------------------------------------------------
const getPaymentHistory = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

        const filter = { user: req.user.id, source: 'purchase' };

        const [transactions, total] = await Promise.all([
            WalletTransaction.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('package', 'name')
                .lean(),
            WalletTransaction.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            transactions: transactions.map((t) => ({
                id: String(t._id),
                amount: t.amount,
                status: t.status,
                package_name: t.package?.name || null,
                razorpay_order_id: t.razorpayOrderId,
                razorpay_payment_id: t.razorpayPaymentId,
                created_at: t.createdAt,
            })),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                limit,
            },
        });
    } catch (error) {
        console.error('Get payment history error:', error);
        return next(error);
    }
};

module.exports = {
    getPointPackages,
    createOrder,
    verifyPayment,
    handleWebhook,
    getPaymentHistory,
    isPaymentsConfigured,
};
