/**
 * PointPackage — purchasable credit bundles (Razorpay).
 *
 * `priceInPaise` is an integer. Razorpay works in paise already, and the MySQL
 * DECIMAL(10,2) only avoided float error because the driver was configured with
 * decimalNumbers: true. Storing the minor unit removes the question entirely.
 */

const mongoose = require('mongoose');

const pointPackageSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },

    points: { type: Number, required: true, min: 1 },
    priceInPaise: { type: Number, required: true, min: 0 },

    // Extra credits granted on top of `points`, for bundle deals.
    bonusPoints: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('PointPackage', pointPackageSchema);
