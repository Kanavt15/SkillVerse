/**
 * Course reviews.
 *
 * `avgRating` and `reviewCount` stay denormalized on the course — the course
 * list sorts on them, and recomputing per request would mean a $lookup into
 * reviews for every row. They are recalculated inside the same transaction as
 * every review write, so the cache cannot drift from the underlying rows.
 */

const { validationResult } = require('express-validator');

const Review = require('../models/Review');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { withTransaction } = require('../config/mongo');
const { onReviewChanged } = require('../services/cache.service');
const { checkAndAwardBadges } = require('../services/badge.service');

/** Review -> legacy response shape (flat author fields, as the UI reads them). */
const toLegacy = (r) => {
    const author = r.user && typeof r.user === 'object' && r.user.fullName ? r.user : null;
    return {
        id: String(r._id),
        _id: String(r._id),
        user_id: String(author ? author._id : r.user),
        course_id: String(r.course?._id || r.course),
        rating: r.rating,
        comment: r.comment || '',
        full_name: author?.fullName || null,
        profile_image: author?.profileImage || null,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
    };
};

/**
 * Recompute the denormalized rating aggregates for a course.
 * Replaces an UPDATE carrying two correlated subqueries.
 */
const recalcAggregates = async (courseId, session = null) => {
    const [agg] = await Review.aggregate([
        { $match: { course: typeof courseId === 'string' ? new (require('mongoose').Types.ObjectId)(courseId) : courseId } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]).session(session);

    await Course.updateOne(
        { _id: courseId },
        {
            $set: {
                // No reviews left -> 0, matching COALESCE(..., 0).
                avgRating: agg ? Math.round(agg.avg * 100) / 100 : 0,
                reviewCount: agg ? agg.count : 0,
            },
        },
        { session }
    );
};

/** Load a review and confirm the requester owns it. */
const requireOwnReview = async (reviewId, reqUser) => {
    const review = await Review.findById(reviewId).populate('course', 'instructor');
    if (!review) {
        return { error: { status: 404, body: { success: false, message: 'Review not found' } } };
    }
    if (!review.user.equals(reqUser.id) && reqUser.role !== 'admin') {
        return { error: { status: 403, body: { success: false, message: 'Not authorized to modify this review' } } };
    }
    return { review };
};

// ------------------------------------------------------------------
// POST /api/reviews/course/:courseId
// ------------------------------------------------------------------
const createReview = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { courseId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        const course = await Course.findById(courseId).select('instructor');
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        if (course.instructor.equals(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Instructors cannot review their own courses',
            });
        }
        if (!await Enrollment.exists({ user: userId, course: courseId })) {
            return res.status(403).json({
                success: false,
                message: 'You must be enrolled in this course to leave a review',
            });
        }
        if (await Review.exists({ user: userId, course: courseId })) {
            return res.status(409).json({
                success: false,
                message: 'You have already reviewed this course. You can edit your existing review.',
            });
        }

        let created;
        try {
            created = await withTransaction(async (session) => {
                const [review] = await Review.create([{
                    user: userId, course: courseId, rating, comment: comment || '',
                }], { session });

                await recalcAggregates(courseId, session);
                await User.updateOne(
                    { _id: userId },
                    { $inc: { 'learningStats.reviewsPosted': 1 } },
                    { session }
                );

                return review;
            });
        } catch (err) {
            // The unique index is the second line of defense against a
            // concurrent duplicate.
            if (err.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: 'You have already reviewed this course. You can edit your existing review.',
                });
            }
            throw err;
        }

        checkAndAwardBadges(userId, {}).catch(() => {});
        onReviewChanged({ courseId: String(courseId), instructorId: String(course.instructor) })
            .catch((err) => console.error('Cache invalidation error:', err));

        const populated = await Review.findById(created._id).populate('user', 'fullName profileImage');

        return res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            review: toLegacy(populated),
        });
    } catch (error) {
        console.error('Create review error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/reviews/:id
// ------------------------------------------------------------------
const updateReview = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { review, error } = await requireOwnReview(req.params.id, req.user);
        if (error) return res.status(error.status).json(error.body);

        const courseId = review.course?._id || review.course;
        const { rating, comment } = req.body;

        await withTransaction(async (session) => {
            await Review.updateOne(
                { _id: review._id },
                { $set: { rating, comment: comment || '' } },
                { session }
            );
            await recalcAggregates(courseId, session);
        });

        onReviewChanged({
            courseId: String(courseId),
            instructorId: String(review.course?.instructor),
        }).catch((err) => console.error('Cache invalidation error:', err));

        const updated = await Review.findById(review._id).populate('user', 'fullName profileImage');

        return res.json({
            success: true,
            message: 'Review updated successfully',
            review: toLegacy(updated),
        });
    } catch (error) {
        console.error('Update review error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// DELETE /api/reviews/:id
// ------------------------------------------------------------------
const deleteReview = async (req, res, next) => {
    try {
        const { review, error } = await requireOwnReview(req.params.id, req.user);
        if (error) return res.status(error.status).json(error.body);

        const courseId = review.course?._id || review.course;
        const userId = review.user;

        await withTransaction(async (session) => {
            await Review.deleteOne({ _id: review._id }, { session });
            await recalcAggregates(courseId, session);
            await User.updateOne(
                { _id: userId },
                { $inc: { 'learningStats.reviewsPosted': -1 } },
                { session }
            );
        });

        onReviewChanged({
            courseId: String(courseId),
            instructorId: String(review.course?.instructor),
        }).catch((err) => console.error('Cache invalidation error:', err));

        return res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Delete review error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/reviews/course/:courseId
// ------------------------------------------------------------------
const getCourseReviews = async (req, res, next) => {
    try {
        const { courseId } = req.params;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));

        const filter = { course: courseId };

        const [reviews, total, distribution] = await Promise.all([
            Review.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('user', 'fullName profileImage')
                .lean(),
            Review.countDocuments(filter),
            Review.aggregate([
                { $match: { course: new (require('mongoose').Types.ObjectId)(String(courseId)) } },
                { $group: { _id: '$rating', count: { $sum: 1 } } },
            ]),
        ]);

        // Always report all five buckets so the bar chart renders consistently.
        const ratingDistribution = {
            5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
        };
        distribution.forEach((d) => { ratingDistribution[d._id] = d.count; });

        return res.json({
            success: true,
            reviews: reviews.map(toLegacy),
            ratingDistribution,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalReviews: total,
                limit,
            },
        });
    } catch (error) {
        console.error('Get course reviews error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/reviews/course/:courseId/mine
// ------------------------------------------------------------------
const getUserReview = async (req, res, next) => {
    try {
        const review = await Review.findOne({
            user: req.user.id,
            course: req.params.courseId,
        }).populate('user', 'fullName profileImage').lean();

        return res.json({ success: true, review: review ? toLegacy(review) : null });
    } catch (error) {
        console.error('Get user review error:', error);
        return next(error);
    }
};

module.exports = {
    createReview,
    updateReview,
    deleteReview,
    getCourseReviews,
    getUserReview,
    recalcAggregates,
};
