/**
 * Enrollment and lesson progress.
 *
 * `enrollCourse` is the app's most important atomicity unit: debit the wallet,
 * write the ledger row, create the enrollment, and materialize a LessonProgress
 * document per lesson — all or nothing. A partial failure here either charges a
 * learner for a course they are not enrolled in, or enrolls them for free.
 *
 * `markLessonComplete` was the largest transaction in the MySQL codebase
 * (30-60 statements across five service modules). It is still the biggest, but
 * most of its reads collapsed: the progress aggregate is one countDocuments
 * pair, and the badge evaluator now reads counters off the user document
 * instead of re-deriving them with nine correlated subqueries.
 *
 * PRESERVED DELIBERATELY: the progress denominator is the set of LessonProgress
 * rows created at enrollment time, so lessons added to a course after a learner
 * enrols do not enter that learner's denominator. Changing that is a product
 * decision, not a migration one.
 */

const { validationResult } = require('express-validator');

const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const LessonProgress = require('../models/LessonProgress');
const User = require('../models/User');

const { withTransaction } = require('../config/mongo');
const serialize = require('../serializers');
const walletService = require('../services/wallet.service');
const teachingService = require('../services/teaching.service');
const { createCertificateRecord } = require('./certificate.controller');
const { createNotification } = require('./notification.controller');
const { validateLessonCompletion } = require('../services/antiCheat.service');
const { updateStreakOnActivity, updateDailyXP } = require('../services/streak.service');
const { awardLessonXP, awardCourseXP, awardStreakBonusXP } = require('../services/xp.service');
const { checkAndAwardBadges } = require('../services/badge.service');
const { emitToUser } = require('../socket');
const { onEnrollmentCreated } = require('../services/cache.service');

// ------------------------------------------------------------------
// POST /api/enrollments
// ------------------------------------------------------------------
const enrollCourse = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const courseId = req.body.course_id;
        const userId = req.user.id;

        const course = await Course.findById(courseId).select('title isPublished pointsCost instructor');
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        if (!course.isPublished) {
            return res.status(400).json({
                success: false,
                message: 'Cannot enroll in unpublished course',
            });
        }
        if (course.instructor.equals(userId)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot enroll in your own course',
            });
        }
        if (await Enrollment.exists({ user: userId, course: courseId })) {
            return res.status(400).json({
                success: false,
                message: 'Already enrolled in this course',
            });
        }

        const pointsCost = course.pointsCost || 0;

        let enrollment;
        let walletBalance;

        try {
            const result = await withTransaction(async (session) => {
                let balance = null;

                if (pointsCost > 0) {
                    // Atomic conditional debit — throws if the balance is short,
                    // which aborts the whole transaction.
                    const debited = await walletService.debit(userId, {
                        amount: pointsCost,
                        source: 'enrollment',
                        description: `Enrolled in ${course.title}`,
                        course: courseId,
                    }, session);
                    balance = debited.balance;
                }

                const [created] = await Enrollment.create([{
                    user: userId,
                    course: courseId,
                    pointsPaid: pointsCost,
                }], { session });

                // Snapshot the course's lessons as this learner's progress set.
                const lessons = await Lesson.find({ course: courseId })
                    .select('_id')
                    .session(session)
                    .lean();

                if (lessons.length) {
                    await LessonProgress.insertMany(
                        lessons.map((l) => ({
                            enrollment: created._id,
                            lesson: l._id,
                            user: userId,
                        })),
                        { session }
                    );
                }

                await Course.updateOne(
                    { _id: courseId },
                    { $inc: { enrollmentCount: 1 } },
                    { session }
                );

                return { created, balance };
            });

            enrollment = result.created;
            walletBalance = result.balance;
        } catch (err) {
            if (err instanceof walletService.InsufficientBalanceError) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough points in wallet. You need ${err.required} points but only have ${err.available}.`,
                    required: err.required,
                    available: err.available,
                });
            }
            // A duplicate key here means a concurrent request won the race.
            if (err.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'Already enrolled in this course',
                });
            }
            throw err;
        }

        if (walletBalance === null) {
            walletBalance = await walletService.getBalance(userId);
        }

        // Post-commit side effects. These must not be able to undo the enrollment.
        createNotification(
            course.instructor,
            'enrollment',
            'New Enrollment',
            `A learner enrolled in your course: ${course.title}`,
            courseId,
            'course'
        ).catch(() => {});

        onEnrollmentCreated({
            courseId: String(courseId),
            instructorId: String(course.instructor),
            userId,
        }).catch((err) => console.error('Cache invalidation error:', err));

        return res.status(201).json({
            success: true,
            message: pointsCost > 0
                ? `Successfully enrolled! ${pointsCost} points spent.`
                : 'Successfully enrolled in free course!',
            enrollment: {
                id: String(enrollment._id),
                user_id: String(userId),
                course_id: String(courseId),
                enrolled_at: enrollment.enrolledAt,
            },
            points_spent: pointsCost,
            wallet_balance: walletBalance,
        });
    } catch (error) {
        console.error('Enroll course error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/enrollments
// ------------------------------------------------------------------
const getEnrolledCourses = async (req, res, next) => {
    try {
        const enrollments = await Enrollment.find({ user: req.user.id })
            .sort({ enrolledAt: -1 })
            .populate({
                path: 'course',
                populate: [
                    { path: 'instructor', select: 'fullName username profileImage teaching' },
                    { path: 'category', select: 'name slug icon' },
                ],
            })
            .lean();

        // Completed-lesson counts for every enrollment in one grouped query,
        // replacing the conditional COUNT(DISTINCT CASE ...) inside a 5-way join.
        const ids = enrollments.map((e) => e._id);
        const counts = await LessonProgress.aggregate([
            { $match: { enrollment: { $in: ids } } },
            {
                $group: {
                    _id: '$enrollment',
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: ['$isCompleted', 1, 0] } },
                },
            },
        ]);
        const byEnrollment = new Map(counts.map((c) => [String(c._id), c]));

        const courses = enrollments
            .filter((e) => e.course)
            .map((e) => {
                const c = byEnrollment.get(String(e._id)) || { total: 0, completed: 0 };
                return {
                    ...serialize.course(e.course),
                    // Enrollment fields the "My Learning" screen reads.
                    enrollment_id: String(e._id),
                    id: String(e.course._id),
                    course_id: String(e.course._id),
                    enrolled_at: e.enrolledAt,
                    completed_at: e.completedAt,
                    progress_percentage: e.progressPercentage,
                    total_lessons: c.total,
                    completed_lessons: c.completed,
                };
            });

        return res.json({ success: true, count: courses.length, courses });
    } catch (error) {
        console.error('Get enrolled courses error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/enrollments/course/:courseId
// ------------------------------------------------------------------
const getCourseProgress = async (req, res, next) => {
    try {
        const enrollment = await Enrollment.findOne({
            user: req.user.id,
            course: req.params.courseId,
        }).lean();

        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'Not enrolled in this course' });
        }

        const progress = await LessonProgress.find({ enrollment: enrollment._id })
            .populate('lesson', 'title order durationMinutes')
            .lean();

        // Ordered by lesson position, as the SQL's ORDER BY l.lesson_order did.
        progress.sort((a, b) => (a.lesson?.order ?? 0) - (b.lesson?.order ?? 0));

        return res.json({
            success: true,
            enrollment: {
                id: String(enrollment._id),
                user_id: String(enrollment.user),
                course_id: String(enrollment.course),
                enrolled_at: enrollment.enrolledAt,
                completed_at: enrollment.completedAt,
                progress_percentage: enrollment.progressPercentage,
            },
            progress: progress.map((p) => ({
                id: String(p._id),
                enrollment_id: String(p.enrollment),
                lesson_id: p.lesson ? String(p.lesson._id) : null,
                lesson_title: p.lesson?.title || null,
                lesson_order: p.lesson?.order ?? null,
                is_completed: p.isCompleted,
                completed_at: p.completedAt,
                time_spent_minutes: p.timeSpentMinutes,
                last_accessed_at: p.lastAccessedAt,
            })),
        });
    } catch (error) {
        console.error('Get course progress error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/enrollments/lesson/:lessonId/complete
// ------------------------------------------------------------------
const markLessonComplete = async (req, res, next) => {
    try {
        const { lessonId } = req.params;
        const timeSpentMinutes = parseInt(req.body.time_spent_minutes, 10) || 0;
        const userId = req.user.id;

        // Anti-cheat runs before the transaction opens — these are read-only
        // checks and holding a transaction across them buys nothing.
        const antiCheat = await validateLessonCompletion(userId, lessonId, {
            timeSpentSeconds: timeSpentMinutes * 60,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });

        if (!antiCheat.allowed) {
            return res.status(400).json({
                success: false,
                message: antiCheat.message || 'Action not allowed',
                reason: antiCheat.reason,
            });
        }

        // Idempotency: re-completing awards nothing.
        if (antiCheat.alreadyCompleted) {
            return res.json({
                success: true,
                message: 'Lesson already completed',
                alreadyCompleted: true,
            });
        }

        const lesson = await Lesson.findById(lessonId).populate('course', 'title difficulty pointsReward instructor');
        if (!lesson || !lesson.course) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }
        const course = lesson.course;

        const enrollment = await Enrollment.findOne({ user: userId, course: course._id });
        if (!enrollment) {
            return res.status(404).json({
                success: false,
                message: 'Lesson not found or not enrolled in course',
            });
        }

        const outcome = await withTransaction(async (session) => {
            // 1. Mark the lesson complete.
            await LessonProgress.updateOne(
                { enrollment: enrollment._id, lesson: lessonId },
                {
                    $set: { isCompleted: true, completedAt: new Date(), lastAccessedAt: new Date() },
                    $inc: { timeSpentMinutes },
                    $setOnInsert: { enrollment: enrollment._id, lesson: lessonId, user: userId },
                },
                { upsert: true, session }
            );

            // 2. Keep the user's own counters current — these feed both badge
            //    evaluation and teaching eligibility.
            await User.updateOne(
                { _id: userId },
                {
                    $inc: {
                        'learningStats.lessonsCompleted': 1,
                        'learningStats.learningMinutes': timeSpentMinutes,
                    },
                },
                { session }
            );

            // 3. Streak, then XP (the streak tells us if this is the first
            //    activity today, which carries a bonus).
            const streak = await updateStreakOnActivity(userId, session);
            const xp = await awardLessonXP(
                userId, lessonId, lesson.title, streak.isFirstActivityToday, session
            );
            await updateDailyXP(userId, xp.totalXP, session, {
                lessonsCompleted: 1,
                timeSpentMinutes,
            });

            let streakBonus = null;
            if (streak.streakMilestone) {
                streakBonus = await awardStreakBonusXP(userId, streak.streakMilestone, session);
            }

            // 4. Recompute course progress from this learner's snapshot.
            const [total, completed] = await Promise.all([
                LessonProgress.countDocuments({ enrollment: enrollment._id }).session(session),
                LessonProgress.countDocuments({
                    enrollment: enrollment._id, isCompleted: true,
                }).session(session),
            ]);

            const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
            const courseCompleted = progressPercentage === 100;

            await Enrollment.updateOne(
                { _id: enrollment._id },
                {
                    $set: {
                        progressPercentage,
                        completedAt: courseCompleted ? (enrollment.completedAt || new Date()) : null,
                    },
                },
                { session }
            );

            // 5. Course completion rewards.
            let pointsEarned = 0;
            let courseXP = null;
            let certificate = null;

            const firstCompletion = courseCompleted && !enrollment.completedAt;

            if (firstCompletion) {
                if (course.pointsReward > 0) {
                    pointsEarned = course.pointsReward;
                    // Credited to the SAME wallet enrollment spends from. Under
                    // MySQL this went to users.points, a separate currency the
                    // learner could not enroll with.
                    await walletService.credit(userId, {
                        amount: pointsEarned,
                        source: 'reward',
                        description: `Completed: ${course.title}`,
                        course: course._id,
                    }, session);
                }

                courseXP = await awardCourseXP(
                    userId, course._id, course.title, course.difficulty, session
                );
                await updateDailyXP(userId, courseXP.xpAwarded, session);

                await User.updateOne(
                    { _id: userId },
                    { $inc: { 'learningStats.coursesCompleted': 1 } },
                    { session }
                );

                certificate = await createCertificateRecord(userId, course._id, session);
            }

            // 6. Badges, then teaching eligibility — in that order, because an
            //    achievement can award XP that tips a level threshold.
            const badgeMetadata = {
                hour: new Date().getHours(),
                courseId: String(course._id),
                difficulty: course.difficulty,
            };
            const newBadges = await checkAndAwardBadges(userId, badgeMetadata, session);

            const teaching = await teachingService.evaluateAndUnlock(userId, session);

            const finalUser = await User.findById(userId).select('xp level wallet').session(session).lean();

            return {
                progressPercentage,
                courseCompleted,
                firstCompletion,
                pointsEarned,
                xp,
                courseXP,
                streak,
                streakBonus,
                newBadges,
                certificate,
                teaching,
                finalUser,
            };
        });

        // ---- Post-commit: notifications and sockets ----
        // Wrapped so a socket failure cannot turn a successful completion into
        // a 500 for the learner.
        try {
            const o = outcome;

            emitToUser(userId, 'xp_earned', {
                amount: o.xp.totalXP + (o.courseXP?.xpAwarded || 0) + (o.streakBonus?.xpAwarded || 0),
                newXP: o.finalUser.xp,
                breakdown: {
                    lesson: o.xp.totalXP,
                    course: o.courseXP?.xpAwarded || 0,
                    streak: o.streakBonus?.xpAwarded || 0,
                },
            });

            if (o.xp.leveledUp || o.courseXP?.leveledUp) {
                emitToUser(userId, 'level_up', {
                    newLevel: o.finalUser.level,
                    previousLevel: o.xp.previousLevel,
                });
                await createNotification(
                    userId, 'level_up', 'Level Up!',
                    `You reached level ${o.finalUser.level}!`, null, 'level'
                );
            }

            emitToUser(userId, 'streak_update', {
                current: o.streak.currentStreak,
                isExtended: o.streak.streakExtended,
                milestone: o.streak.streakMilestone,
                freezeUsed: o.streak.freezeUsed,
            });

            for (const badge of o.newBadges) {
                emitToUser(userId, 'badge_earned', badge);
                await createNotification(
                    userId, 'badge_earned', 'Achievement Unlocked!',
                    `You earned "${badge.name}"`, badge._id, 'badge'
                );
            }

            if (o.teaching.justUnlocked) {
                await teachingService.announceUnlock(userId);
                emitToUser(userId, 'teaching_unlocked', { requirements: o.teaching.requirements });
            }
        } catch (err) {
            console.error('Post-completion notification error:', err.message);
        }

        return res.json({
            success: true,
            message: 'Lesson marked as complete',
            progress_percentage: outcome.progressPercentage,
            course_completed: outcome.courseCompleted,
            points_earned: outcome.pointsEarned,
            points_balance: outcome.finalUser.wallet?.balance ?? 0,
            certificate_id: outcome.certificate?.certificateId || null,
            gamification: {
                xp: {
                    earned: outcome.xp.totalXP + (outcome.courseXP?.xpAwarded || 0)
                        + (outcome.streakBonus?.xpAwarded || 0),
                    total: outcome.finalUser.xp,
                    level: outcome.finalUser.level,
                    leveledUp: outcome.xp.leveledUp || Boolean(outcome.courseXP?.leveledUp),
                },
                streak: {
                    current: outcome.streak.currentStreak,
                    extended: outcome.streak.streakExtended,
                    milestone: outcome.streak.streakMilestone,
                },
                badges: outcome.newBadges.map((b) => ({
                    id: String(b._id),
                    name: b.name,
                    tier: b.tier,
                    icon: b.icon,
                    xp_reward: b.xpReward,
                })),
                teaching: {
                    justUnlocked: outcome.teaching.justUnlocked,
                    eligible: outcome.teaching.eligible,
                },
            },
        });
    } catch (error) {
        console.error('Mark lesson complete error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/enrollments/lesson/:lessonId/progress
// ------------------------------------------------------------------
const updateLessonProgress = async (req, res, next) => {
    try {
        const { lessonId } = req.params;
        const timeSpentMinutes = parseInt(req.body.time_spent_minutes, 10) || 0;

        const lesson = await Lesson.findById(lessonId).select('course');
        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        const enrollment = await Enrollment.findOne({
            user: req.user.id,
            course: lesson.course,
        }).select('_id');

        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'Not enrolled in this course' });
        }

        await LessonProgress.updateOne(
            { enrollment: enrollment._id, lesson: lessonId },
            {
                $inc: { timeSpentMinutes },
                $set: { lastAccessedAt: new Date() },
                $setOnInsert: { enrollment: enrollment._id, lesson: lessonId, user: req.user.id },
            },
            { upsert: true }
        );

        return res.json({ success: true, message: 'Progress updated' });
    } catch (error) {
        console.error('Update lesson progress error:', error);
        return next(error);
    }
};

module.exports = {
    enrollCourse,
    getEnrolledCourses,
    getCourseProgress,
    markLessonComplete,
    updateLessonProgress,
};
