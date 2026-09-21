/**
 * DailyActivity — one row per user per day, driving the streak heatmap.
 *
 * `date` is a YYYY-MM-DD string in the USER's timezone, not a Date. Storing a
 * Date would mean converting back and forth through UTC, which is exactly what
 * makes the current streak calculation off by one day on non-UTC servers.
 * A string computed once, in the user's zone, has no such round trip.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const dailyActivitySchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    date: {
        type: String,
        required: true,
        match: [/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'],
    },

    lessonsCompleted: { type: Number, default: 0, min: 0 },
    problemsSolved: { type: Number, default: 0, min: 0 },
    quizzesCompleted: { type: Number, default: 0, min: 0 },
    xpEarned: { type: Number, default: 0, min: 0 },
    timeSpentMinutes: { type: Number, default: 0, min: 0 },
    streakMaintained: { type: Boolean, default: false },
}, { timestamps: true });

// Replaces `unique_user_date`. The streak service upserts against this.
dailyActivitySchema.index({ user: 1, date: 1 }, { unique: true });
dailyActivitySchema.index({ date: 1 });

module.exports = mongoose.model('DailyActivity', dailyActivitySchema);
