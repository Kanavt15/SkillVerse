/**
 * Teaching dashboard statistics.
 *
 * REVENUE FIX: the MySQL version computed instructor earnings from
 * `point_transactions WHERE type = 'spent'` — but enrollment never wrote to
 * that table (it debited `wallets`), so reported revenue was structurally
 * always zero. With one unified ledger, revenue is the sum of `enrollment`
 * debits against this instructor's courses, which is a real number.
 */

const mongoose = require('mongoose');

const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Review = require('../models/Review');
const WalletTransaction = require('../models/WalletTransaction');
const { cacheGetOrSet, CacheKeys, CacheTTL } = require('../utils/cache.utils');

const toObjectId = (v) => new mongoose.Types.ObjectId(String(v));

async function computeStats(instructorId) {
    const instructor = toObjectId(instructorId);

    const courses = await Course.find({ instructor }).select('_id avgRating reviewCount isPublished').lean();
    const courseIds = courses.map((c) => c._id);

    if (!courseIds.length) {
        return {
            total_courses: 0,
            published_courses: 0,
            total_students: 0,
            total_enrollments: 0,
            completed_enrollments: 0,
            completion_rate: 0,
            avg_rating: 0,
            total_reviews: 0,
            total_revenue: 0,
            recent_enrollments: 0,
        };
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);

    const [enrollmentAgg, reviewAgg, revenueAgg, recentCount, distinctStudents] = await Promise.all([
        Enrollment.aggregate([
            { $match: { course: { $in: courseIds } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $ne: ['$completedAt', null] }, 1, 0] } },
                },
            },
        ]),
        Review.aggregate([
            { $match: { course: { $in: courseIds } } },
            { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]),
        // Real revenue: credits spent enrolling in this instructor's courses.
        WalletTransaction.aggregate([
            {
                $match: {
                    course: { $in: courseIds },
                    source: 'enrollment',
                    type: 'debit',
                    status: 'success',
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Enrollment.countDocuments({
            course: { $in: courseIds },
            enrolledAt: { $gte: thirtyDaysAgo },
        }),
        Enrollment.distinct('user', { course: { $in: courseIds } }),
    ]);

    const e = enrollmentAgg[0] || { total: 0, completed: 0 };
    const r = reviewAgg[0] || { avg: 0, count: 0 };

    return {
        total_courses: courses.length,
        published_courses: courses.filter((c) => c.isPublished).length,
        // Distinct learners, not enrollment rows — one person taking three
        // courses is one student.
        total_students: distinctStudents.length,
        total_enrollments: e.total,
        completed_enrollments: e.completed,
        // Guarded division; the SQL used NULLIF to avoid divide-by-zero.
        completion_rate: e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0,
        avg_rating: r.avg ? Math.round(r.avg * 100) / 100 : 0,
        total_reviews: r.count,
        total_revenue: revenueAgg[0]?.total || 0,
        recent_enrollments: recentCount,
    };
}

// ------------------------------------------------------------------
// GET /api/instructors/stats
// ------------------------------------------------------------------
const getInstructorStats = async (req, res, next) => {
    try {
        const { data, fromCache } = await cacheGetOrSet(
            CacheKeys.instructorStats(req.user.id),
            CacheTTL.INSTRUCTOR_STATS,
            async () => computeStats(req.user.id)
        );

        res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
        return res.json({ success: true, stats: data });
    } catch (error) {
        console.error('Get instructor stats error:', error);
        return next(error);
    }
};

module.exports = {
    getInstructorStats,
    computeStats,
};
