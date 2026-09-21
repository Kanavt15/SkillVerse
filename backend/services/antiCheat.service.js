/**
 * Anti-cheat guards for lesson completion.
 *
 * The MySQL version stored its evidence in a JSON column and queried it with
 * JSON_EXTRACT(metadata, '$.timeSpent'). `timeSpentSeconds` is now a real,
 * indexed field, so the detection queries are ordinary predicates.
 *
 * Thresholds come from PlatformSettings rather than module constants, so an
 * admin can tighten them without a deploy.
 */

const mongoose = require('mongoose');
const ActivityAuditLog = require('../models/ActivityAuditLog');
const LessonProgress = require('../models/LessonProgress');
const PlatformSettings = require('../models/PlatformSettings');

const toObjectId = (v) => new mongoose.Types.ObjectId(String(v));

const IP_COOLDOWN_MINUTES = 1;
const SUSPICIOUS_COMPLETION_SECONDS = 10;

/**
 * Decide whether a lesson completion should be accepted.
 *
 * Runs BEFORE the completion transaction opens, as it did before — these are
 * read-only checks and there is no reason to hold a transaction across them.
 *
 * @returns {{allowed, reason?, message?, isSuspicious, alreadyCompleted, checks}}
 */
async function validateLessonCompletion(userId, lessonId, metadata = {}) {
    const settings = await PlatformSettings.getSettings();
    const cfg = settings.antiCheat;

    const checks = [];
    let isSuspicious = false;

    const timeSpentSeconds = metadata.timeSpentSeconds ?? 0;

    // 1. Implausibly fast completion. Flagged for review, but NOT blocked —
    //    a learner legitimately reviewing material they already know would
    //    otherwise be locked out.
    if (timeSpentSeconds < cfg.minLessonSeconds) {
        isSuspicious = true;
        checks.push({ check: 'min_time', passed: false, timeSpentSeconds });
    } else {
        checks.push({ check: 'min_time', passed: true });
    }

    // 2. Already completed — return early so the caller skips awarding XP a
    //    second time. This is the idempotency guard.
    const existing = await LessonProgress.findOne({
        user: userId,
        lesson: lessonId,
        isCompleted: true,
    }).lean();

    if (existing) {
        return {
            allowed: true,
            alreadyCompleted: true,
            isSuspicious: false,
            checks,
        };
    }

    const now = Date.now();

    // 3. Hourly and daily completion rate limits. These DO block: nobody
    //    legitimately finishes 20 lessons in an hour.
    const [lastHour, lastDay] = await Promise.all([
        LessonProgress.countDocuments({
            user: userId,
            isCompleted: true,
            completedAt: { $gte: new Date(now - 3600_000) },
        }),
        LessonProgress.countDocuments({
            user: userId,
            isCompleted: true,
            completedAt: { $gte: new Date(now - 86400_000) },
        }),
    ]);

    if (lastHour >= cfg.maxLessonsPerHour) {
        return {
            allowed: false,
            reason: 'rate_limit_hourly',
            message: 'You are completing lessons unusually fast. Please try again later.',
            isSuspicious: true,
            checks,
        };
    }
    checks.push({ check: 'rate_hourly', passed: true, count: lastHour });

    if (lastDay >= cfg.maxLessonsPerDay) {
        return {
            allowed: false,
            reason: 'rate_limit_daily',
            message: 'Daily lesson completion limit reached. Please try again tomorrow.',
            isSuspicious: true,
            checks,
        };
    }
    checks.push({ check: 'rate_daily', passed: true, count: lastDay });

    // 4. Same user, same lesson, same IP within the cooldown — a replayed
    //    request rather than real study.
    const recentDuplicate = await ActivityAuditLog.findOne({
        user: userId,
        entityType: 'lesson',
        entityId: lessonId,
        ipAddress: metadata.ip || null,
        createdAt: { $gte: new Date(now - IP_COOLDOWN_MINUTES * 60_000) },
    }).lean();

    if (recentDuplicate) {
        return {
            allowed: false,
            reason: 'duplicate_too_soon',
            message: 'This lesson was just submitted. Please wait a moment.',
            isSuspicious: true,
            checks,
        };
    }

    // 5. Record the attempt. Audit failure must never fail the request.
    try {
        await ActivityAuditLog.create({
            user: userId,
            actionType: 'complete',
            entityType: 'lesson',
            entityId: lessonId,
            ipAddress: metadata.ip || null,
            userAgent: metadata.userAgent || null,
            timeSpentSeconds,
            isSuspicious,
            metadata: { timestamp: new Date().toISOString() },
        });
    } catch (err) {
        console.error('Audit log error:', err.message);
    }

    return { allowed: true, alreadyCompleted: false, isSuspicious, checks };
}

/**
 * Look for patterns suggesting automation. Surfaced in the admin panel.
 */
async function detectSuspiciousActivity(userId) {
    const now = Date.now();
    const weekAgo = new Date(now - 7 * 86400_000);

    const [fastCompletions, distinctIps, dayCount] = await Promise.all([
        // Was JSON_EXTRACT(metadata, '$.timeSpent') < 10.
        ActivityAuditLog.countDocuments({
            user: userId,
            actionType: 'complete',
            timeSpentSeconds: { $lt: SUSPICIOUS_COMPLETION_SECONDS },
            createdAt: { $gte: weekAgo },
        }),
        ActivityAuditLog.distinct('ipAddress', {
            user: userId,
            createdAt: { $gte: new Date(now - 3600_000) },
        }),
        ActivityAuditLog.countDocuments({
            user: userId,
            actionType: 'complete',
            createdAt: { $gte: new Date(now - 86400_000) },
        }),
    ]);

    const patterns = [];

    if (fastCompletions >= 10) {
        patterns.push({
            type: 'fast_completion_pattern',
            severity: 'high',
            detail: `${fastCompletions} lessons completed in under ${SUSPICIOUS_COMPLETION_SECONDS}s in the last week`,
        });
    }

    const ipCount = distinctIps.filter(Boolean).length;
    if (ipCount > 3) {
        patterns.push({
            type: 'multiple_ips',
            severity: 'medium',
            detail: `${ipCount} distinct IP addresses in the last hour`,
        });
    }

    if (dayCount > 50) {
        patterns.push({
            type: 'excessive_activity',
            severity: 'medium',
            detail: `${dayCount} lesson completions in 24 hours`,
        });
    }

    return patterns;
}

/** Detail view for a flagged account. */
async function getSuspiciousActivityReport(userId) {
    const weekAgo = new Date(Date.now() - 7 * 86400_000);

    const [flagged, stats, patterns] = await Promise.all([
        ActivityAuditLog.find({ user: userId, isSuspicious: true })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean(),
        ActivityAuditLog.aggregate([
            { $match: { user: toObjectId(userId), createdAt: { $gte: weekAgo } } },
            {
                $group: {
                    _id: null,
                    avgTimeSpent: { $avg: '$timeSpentSeconds' },
                    minTimeSpent: { $min: '$timeSpentSeconds' },
                    maxTimeSpent: { $max: '$timeSpentSeconds' },
                    distinctIps: { $addToSet: '$ipAddress' },
                    total: { $sum: 1 },
                },
            },
        ]),
        detectSuspiciousActivity(userId),
    ]);

    const s = stats[0] || {};
    const highest = patterns.reduce(
        (acc, p) => (p.severity === 'high' ? 'high' : acc),
        patterns.length ? 'medium' : 'low'
    );

    return {
        flaggedEvents: flagged.length,
        recentFlagged: flagged,
        stats: {
            avgTimeSpent: s.avgTimeSpent || 0,
            minTimeSpent: s.minTimeSpent || 0,
            maxTimeSpent: s.maxTimeSpent || 0,
            distinctIps: (s.distinctIps || []).filter(Boolean).length,
            totalEvents: s.total || 0,
        },
        patterns,
        riskLevel: highest,
    };
}

/** Admin action: clear the flags on an account after review. */
async function clearSuspiciousFlags(userId) {
    const result = await ActivityAuditLog.updateMany(
        { user: userId, isSuspicious: true },
        { $set: { isSuspicious: false } }
    );
    return result.modifiedCount;
}

module.exports = {
    validateLessonCompletion,
    detectSuspiciousActivity,
    getSuspiciousActivityReport,
    clearSuspiciousFlags,
};
