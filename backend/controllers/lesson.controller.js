/**
 * Lessons.
 *
 * Two structural changes from the MySQL version:
 *
 *   - `lesson_resources` was a separate table joined on every read. Resources
 *     are now embedded in the lesson document, so the JOIN and its
 *     COUNT/GROUP BY disappear.
 *
 *   - `courses.lessonCount` is denormalized and maintained here. That is what
 *     lets the course list render without a COUNT(DISTINCT) join per row.
 */

const { validationResult } = require('express-validator');

const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const serialize = require('../serializers');
const { createNotification } = require('./notification.controller');
const { onCourseUpdated } = require('../services/cache.service');

/**
 * Load a course and confirm the requester may modify it.
 * Returns { error } to be returned directly, or { course }.
 */
const requireCourseOwnership = async (courseId, reqUser, action) => {
    const course = await Course.findById(courseId).select('instructor title isPublished');

    if (!course) {
        return { error: { status: 404, body: { success: false, message: 'Course not found' } } };
    }

    // ObjectId comparison must use .equals(); `===` compares object identity.
    if (!course.instructor.equals(reqUser.id) && reqUser.role !== 'admin') {
        return {
            error: {
                status: 403,
                body: { success: false, message: `Not authorized to ${action} this course` },
            },
        };
    }

    return { course };
};

/** FormData sends booleans as the strings 'true'/'false'. */
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';

// ------------------------------------------------------------------
// POST /api/courses/:id/lessons  (and POST /api/lessons)
// ------------------------------------------------------------------
const createLesson = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const courseId = req.body.course_id || req.params.id;
        const {
            title, description, lesson_order: lessonOrder,
            video_url: videoUrl, duration_minutes: durationMinutes,
            content, is_free: isFree = false, module_id: moduleId,
        } = req.body;

        const { course, error } = await requireCourseOwnership(courseId, req.user, 'add lessons to');
        if (error) return res.status(error.status).json(error.body);

        const lesson = await Lesson.create({
            course: courseId,
            module: moduleId || null,
            title,
            description: description || '',
            order: parseInt(lessonOrder, 10) || 0,
            videoUrl: req.file ? `/uploads/videos/${req.file.filename}` : (videoUrl || null),
            durationMinutes: parseInt(durationMinutes, 10) || 0,
            content: content || '',
            isFree: toBool(isFree),
        });

        // Keep the denormalized counter in step with reality.
        await Course.updateOne({ _id: courseId }, { $inc: { lessonCount: 1 } });

        // Tell enrolled learners, in one batched write rather than one insert
        // per learner.
        notifyEnrolledLearners(courseId, course.title, title, lesson._id)
            .catch((err) => console.error('Lesson notification error:', err));

        onCourseUpdated({ courseId: String(courseId), instructorId: String(course.instructor) })
            .catch((err) => console.error('Cache invalidation error:', err));

        return res.status(201).json({
            success: true,
            message: 'Lesson created successfully',
            lesson: serialize.lesson(lesson),
        });
    } catch (error) {
        console.error('Create lesson error:', error);
        return next(error);
    }
};

async function notifyEnrolledLearners(courseId, courseTitle, lessonTitle, lessonId) {
    const enrollments = await Enrollment.find({ course: courseId }).select('user').lean();
    if (!enrollments.length) return;

    await createNotification.bulk(enrollments.map((e) => ({
        user: e.user,
        type: 'new_lesson',
        title: 'New Lesson Available',
        message: `New lesson "${lessonTitle}" added to ${courseTitle || 'a course'}`,
        referenceId: lessonId,
        referenceType: 'lesson',
    })));
}

// ------------------------------------------------------------------
// GET /api/lessons/course/:courseId
// ------------------------------------------------------------------
const getCourseLessons = async (req, res, next) => {
    try {
        const lessons = await Lesson.find({ course: req.params.courseId })
            .sort({ order: 1 })
            .lean();

        return res.json({
            success: true,
            count: lessons.length,
            lessons: lessons.map((l) => ({
                ...serialize.lesson(l),
                // Was a COUNT over the joined lesson_resources table.
                resource_count: (l.resources || []).length,
            })),
        });
    } catch (error) {
        console.error('Get lessons error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/lessons/:id
// ------------------------------------------------------------------
const getLessonById = async (req, res, next) => {
    try {
        const lesson = await Lesson.findById(req.params.id)
            .populate('course', 'title instructor')
            .lean();

        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        const courseDoc = lesson.course;

        return res.json({
            success: true,
            lesson: {
                ...serialize.lesson({ ...lesson, course: courseDoc?._id }),
                course_title: courseDoc?.title || null,
                instructor_id: courseDoc?.instructor ? String(courseDoc.instructor) : null,
            },
        });
    } catch (error) {
        console.error('Get lesson error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/lessons/:id
// ------------------------------------------------------------------
const updateLesson = async (req, res, next) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        // Ownership lives on the parent course, as it did through the JOIN.
        const { course, error } = await requireCourseOwnership(lesson.course, req.user, 'update lessons in');
        if (error) return res.status(error.status).json(error.body);

        const b = req.body;
        const updates = {};

        if (b.title) updates.title = b.title;
        if (b.description !== undefined) updates.description = b.description;
        if (b.lesson_order !== undefined) updates.order = parseInt(b.lesson_order, 10);
        if (b.video_url !== undefined) updates.videoUrl = b.video_url;
        if (req.file) updates.videoUrl = `/uploads/videos/${req.file.filename}`;
        if (b.duration_minutes !== undefined) updates.durationMinutes = parseInt(b.duration_minutes, 10);
        if (b.content !== undefined) updates.content = b.content;
        if (b.is_free !== undefined) updates.isFree = toBool(b.is_free);
        if (b.module_id !== undefined) updates.module = b.module_id || null;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        const updated = await Lesson.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        onCourseUpdated({ courseId: String(lesson.course), instructorId: String(course.instructor) })
            .catch((err) => console.error('Cache invalidation error:', err));

        return res.json({
            success: true,
            message: 'Lesson updated successfully',
            lesson: serialize.lesson(updated),
        });
    } catch (error) {
        console.error('Update lesson error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// DELETE /api/lessons/:id
// ------------------------------------------------------------------
const deleteLesson = async (req, res, next) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        const { course, error } = await requireCourseOwnership(lesson.course, req.user, 'delete lessons from');
        if (error) return res.status(error.status).json(error.body);

        const courseId = lesson.course;

        // Cascade removes LessonProgress rows and any discussion posts anchored
        // to this lesson — previously handled by ON DELETE CASCADE.
        await Lesson.findByIdAndDelete(req.params.id);

        await Course.updateOne({ _id: courseId }, { $inc: { lessonCount: -1 } });

        onCourseUpdated({ courseId: String(courseId), instructorId: String(course.instructor) })
            .catch((err) => console.error('Cache invalidation error:', err));

        return res.json({ success: true, message: 'Lesson deleted successfully' });
    } catch (error) {
        console.error('Delete lesson error:', error);
        return next(error);
    }
};

module.exports = {
    createLesson,
    getCourseLessons,
    getLessonById,
    updateLesson,
    deleteLesson,
};
