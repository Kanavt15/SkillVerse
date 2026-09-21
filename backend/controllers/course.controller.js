/**
 * Course controller.
 *
 * The heavy piece is the course list, which in MySQL was 4 LEFT JOINs + 2
 * COUNT(DISTINCT) + GROUP BY + HAVING + FULLTEXT relevance across 7 tables,
 * plus a derived-table subquery just to count rows when tag AND-logic was on.
 *
 * Two things make the MongoDB version much smaller:
 *
 *   1. `lessonCount` and `enrollmentCount` are denormalized onto the Course
 *      document, so the two COUNT(DISTINCT) joins disappear entirely. They are
 *      maintained by the lesson and enrollment controllers.
 *
 *   2. Tags are an array on the course, so the AND case is `$all` and the OR
 *      case is `$in` — replacing the GROUP BY / HAVING COUNT(DISTINCT) trick
 *      and the subquery that existed only to count its results.
 *
 * The Redis caching layer is unchanged: same keys, same TTLs, same invalidation
 * hooks. It was never coupled to SQL.
 */

const mongoose = require('mongoose');
const { validationResult } = require('express-validator');

const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Module = require('../models/Module');
const Tag = require('../models/Tag');
const Follow = require('../models/Follow');
const User = require('../models/User');

const serialize = require('../serializers');
const { createNotification } = require('./notification.controller');
const { cacheGetOrSet, CacheKeys, CacheTTL } = require('../utils/cache.utils');
const { onCourseCreated, onCourseUpdated, onCourseDeleted } = require('../services/cache.service');

/** Points defaults by difficulty, as in the MySQL controller. */
const DIFFICULTY_DEFAULTS = {
    beginner: { cost: 50, reward: 75 },
    intermediate: { cost: 100, reward: 150 },
    advanced: { cost: 200, reward: 300 },
};

const slugify = (title) => String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

/** Unique slug, suffixed on collision. */
const uniqueSlug = async (title) => {
    const base = slugify(title) || 'course';
    let candidate = base;
    let n = 0;
    /* eslint-disable no-await-in-loop */
    while (await Course.exists({ slug: candidate })) {
        n += 1;
        candidate = `${base}-${n}`;
    }
    /* eslint-enable no-await-in-loop */
    return candidate;
};

const toObjectIds = (values) => values
    .filter((v) => mongoose.isValidObjectId(v))
    .map((v) => new mongoose.Types.ObjectId(String(v)));

// ------------------------------------------------------------------
// POST /api/courses
// ------------------------------------------------------------------
const createCourse = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const {
            title, description, category_id: categoryId,
            difficulty_level: difficultyLevel,
            points_cost: pointsCost, points_reward: pointsReward,
        } = req.body;

        const difficulty = difficultyLevel || 'beginner';
        const defaults = DIFFICULTY_DEFAULTS[difficulty] || DIFFICULTY_DEFAULTS.beginner;

        const course = await Course.create({
            instructor: req.user.id,
            category: mongoose.isValidObjectId(categoryId) ? categoryId : null,
            title,
            slug: await uniqueSlug(title),
            description: description || '',
            difficulty,
            pointsCost: pointsCost !== undefined ? parseInt(pointsCost, 10) : defaults.cost,
            pointsReward: pointsReward !== undefined ? parseInt(pointsReward, 10) : defaults.reward,
            thumbnail: req.file ? `/uploads/thumbnails/${req.file.filename}` : null,
        });

        // Track authorship on the teaching profile.
        await User.updateOne(
            { _id: req.user.id },
            { $inc: { 'teaching.coursesCreated': 1 } }
        );

        onCourseCreated({
            courseId: String(course._id),
            instructorId: req.user.id,
            categoryId,
        }).catch((err) => console.error('Cache invalidation error:', err));

        return res.status(201).json({
            success: true,
            message: 'Course created successfully',
            course: serialize.course(course),
        });
    } catch (error) {
        console.error('Create course error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/courses
// ------------------------------------------------------------------

/**
 * Build the $match stage from query filters.
 * Returns null when a filter references an id that cannot match anything.
 */
const buildMatch = (q) => {
    const match = { isPublished: true };

    if (q.instructor_id) {
        if (!mongoose.isValidObjectId(q.instructor_id)) return null;
        match.instructor = new mongoose.Types.ObjectId(String(q.instructor_id));
    }
    if (q.category_id) {
        if (!mongoose.isValidObjectId(q.category_id)) return null;
        match.category = new mongoose.Types.ObjectId(String(q.category_id));
    }
    if (q.difficulty_level) {
        match.difficulty = q.difficulty_level;
    }
    if (q.min_rating) {
        match.avgRating = { $gte: parseFloat(q.min_rating) };
    }
    if (q.max_price !== undefined && q.max_price !== '') {
        match.pointsCost = { $lte: parseInt(q.max_price, 10) };
    }
    if (q.min_duration || q.max_duration) {
        match.durationHours = {};
        if (q.min_duration) match.durationHours.$gte = parseFloat(q.min_duration);
        if (q.max_duration) match.durationHours.$lte = parseFloat(q.max_duration);
    }

    // Tag filtering. `$all` requires every tag, `$in` requires any — replacing
    // the GROUP BY + HAVING COUNT(DISTINCT) construction the SQL needed.
    const tagIds = toObjectIds(
        Array.isArray(q.tags) ? q.tags : String(q.tags || '').split(',').map((t) => t.trim())
    );
    if (tagIds.length) {
        match.tags = q.tag_logic === 'and' ? { $all: tagIds } : { $in: tagIds };
    }

    return match;
};

/** Sort spec. `search` promotes text relevance to the primary key, as before. */
const buildSort = (sortBy, hasSearch) => {
    if (hasSearch) {
        return { score: { $meta: 'textScore' }, avgRating: -1 };
    }
    switch (sortBy) {
        case 'rating': return { avgRating: -1, reviewCount: -1 };
        case 'popular': return { enrollmentCount: -1 };
        case 'oldest': return { createdAt: 1 };
        default: return { createdAt: -1 };
    }
};

/**
 * Fetch a page of courses. Kept as a standalone function because the cache
 * layer calls it as its miss-handler.
 */
async function fetchCourses(query, page, limit) {
    const match = buildMatch(query);
    if (match === null) {
        return {
            success: true,
            count: 0,
            courses: [],
            pagination: { currentPage: page, totalPages: 0, totalCourses: 0, limit },
        };
    }

    const search = (query.search || '').trim();
    const hasSearch = search.length > 0;
    if (hasSearch) {
        match.$text = { $search: search };
    }

    // Run the page and its count together. countDocuments with the same filter
    // is exact, so the derived-table subquery the SQL needed is unnecessary.
    const projection = hasSearch ? { score: { $meta: 'textScore' } } : {};

    const [courses, total] = await Promise.all([
        Course.find(match, projection)
            .sort(buildSort(query.sort_by, hasSearch))
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('instructor', 'fullName username bio profileImage teaching xp level')
            .populate('category', 'name slug icon')
            .populate('tags', 'name slug')
            .lean({ virtuals: true }),
        Course.countDocuments(match),
    ]);

    return {
        success: true,
        count: courses.length,
        courses: courses.map(serialize.course),
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalCourses: total,
            limit,
        },
    };
}

const getAllCourses = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

        const {
            search, instructor_id: instructorId, difficulty_level: difficulty,
            tags, min_rating: minRating, max_price: maxPrice,
            min_duration: minDuration, max_duration: maxDuration,
            sort_by: sortBy, category_id: categoryId,
        } = req.query;

        // Same cache gate as before: only the plain browse view is cacheable,
        // because filtered permutations explode the key space.
        const useCache = !search && !instructorId && !difficulty
            && !(tags && tags.length) && !minRating && !maxPrice
            && !minDuration && !maxDuration;

        if (useCache) {
            const cacheKey = CacheKeys.courseList(sortBy, categoryId, page, limit);
            const { data, fromCache } = await cacheGetOrSet(
                cacheKey,
                CacheTTL.COURSE_LIST,
                async () => fetchCourses({ category_id: categoryId, sort_by: sortBy }, page, limit)
            );
            res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
            return res.json(data);
        }

        const data = await fetchCourses(req.query, page, limit);
        res.set('X-Cache', 'BYPASS');
        return res.json(data);
    } catch (error) {
        console.error('Get courses error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/courses/:id
// ------------------------------------------------------------------
const getCourseById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const course = await Course.findById(id)
            .populate('instructor', 'fullName username bio profileImage teaching xp level')
            .populate('category', 'name slug icon')
            .populate('tags', 'name slug')
            .lean({ virtuals: true });

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const [lessons, modules] = await Promise.all([
            Lesson.find({ course: id }).sort({ order: 1 }).lean(),
            Module.find({ course: id }).sort({ order: 1 }).lean(),
        ]);

        return res.json({
            success: true,
            course: serialize.course({ ...course, lessons, modules }),
        });
    } catch (error) {
        console.error('Get course error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/courses/instructor
// ------------------------------------------------------------------
const getInstructorCourses = async (req, res, next) => {
    try {
        const courses = await Course.find({ instructor: req.user.id })
            .sort({ createdAt: -1 })
            .populate('category', 'name slug icon')
            .populate('tags', 'name slug')
            .lean({ virtuals: true });

        return res.json({
            success: true,
            count: courses.length,
            courses: courses.map(serialize.course),
        });
    } catch (error) {
        console.error('Get instructor courses error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/courses/:id
// ------------------------------------------------------------------
const updateCourse = async (req, res, next) => {
    try {
        const { id } = req.params;

        const course = await Course.findById(id);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        // Ownership. ObjectIds must be compared with .equals(), never === —
        // two ObjectId instances for the same id are different objects.
        const isOwner = course.instructor.equals(req.user.id);
        const isAdmin = req.user.role === 'admin';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this course',
            });
        }

        const b = req.body;
        const updates = {};

        if (b.title) {
            updates.title = b.title;
        }
        if (b.description !== undefined) updates.description = b.description;
        if (b.category_id && mongoose.isValidObjectId(b.category_id)) {
            updates.category = b.category_id;
        }
        if (b.difficulty_level) updates.difficulty = b.difficulty_level;
        if (b.points_cost !== undefined) updates.pointsCost = parseInt(b.points_cost, 10);
        if (b.points_reward !== undefined) updates.pointsReward = parseInt(b.points_reward, 10);
        if (b.duration_hours !== undefined) updates.durationHours = parseFloat(b.duration_hours);
        if (b.learning_objectives !== undefined) updates.learningObjectives = b.learning_objectives;
        if (b.prerequisites !== undefined) updates.prerequisites = b.prerequisites;
        if (req.file) updates.thumbnail = `/uploads/thumbnails/${req.file.filename}`;

        if (Array.isArray(b.tags)) {
            updates.tags = toObjectIds(b.tags);
        }

        const wasPublished = course.isPublished;
        const nowPublished = b.is_published === true || b.is_published === 'true' || b.is_published === 1;
        if (b.is_published !== undefined) {
            updates.isPublished = nowPublished;
            if (nowPublished && !course.publishedAt) {
                updates.publishedAt = new Date();
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        const updated = await Course.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        )
            .populate('instructor', 'fullName username bio profileImage teaching')
            .populate('category', 'name slug icon')
            .populate('tags', 'name slug');

        // Notify followers on the transition into published, not on every save
        // of an already-published course.
        if (!wasPublished && nowPublished) {
            await User.updateOne(
                { _id: course.instructor },
                { $inc: { 'teaching.coursesPublished': 1 } }
            );
            notifyFollowers(course.instructor, updated.title, id)
                .catch((err) => console.error('Follower notification error:', err));
        }

        onCourseUpdated({
            courseId: id,
            instructorId: String(course.instructor),
            categoryId: updates.category || course.category,
        }).catch((err) => console.error('Cache invalidation error:', err));

        return res.json({
            success: true,
            message: 'Course updated successfully',
            course: serialize.course(updated),
        });
    } catch (error) {
        console.error('Update course error:', error);
        return next(error);
    }
};

/**
 * Fan out a "new course" notification to an instructor's followers.
 *
 * The MySQL version looped over an unbounded follower list issuing one INSERT
 * per follower with no batching. This inserts them in one call.
 */
async function notifyFollowers(instructorId, courseTitle, courseId) {
    const [instructor, followers] = await Promise.all([
        User.findById(instructorId).select('fullName').lean(),
        Follow.find({ following: instructorId }).select('follower').lean(),
    ]);

    if (!followers.length) return;

    const name = instructor?.fullName || 'An instructor you follow';
    await createNotification.bulk(followers.map((f) => ({
        user: f.follower,
        type: 'course_updated',
        title: 'New Course from an Instructor You Follow',
        message: `${name} published a new course: "${courseTitle}"`,
        referenceId: courseId,
        referenceType: 'course',
    })));
}

// ------------------------------------------------------------------
// DELETE /api/courses/:id
// ------------------------------------------------------------------
const deleteCourse = async (req, res, next) => {
    try {
        const { id } = req.params;

        const course = await Course.findById(id);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const isOwner = course.instructor.equals(req.user.id);
        if (!isOwner && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this course',
            });
        }

        const categoryId = course.category;
        const instructorId = course.instructor;

        // The cascade plugin removes modules, lessons, enrollments, progress,
        // reviews, certificates, discussions and quizzes. MySQL did this via
        // ON DELETE CASCADE, which Mongoose has no equivalent for.
        await Course.findByIdAndDelete(id);

        await User.updateOne(
            { _id: instructorId },
            {
                $inc: {
                    'teaching.coursesCreated': -1,
                    ...(course.isPublished ? { 'teaching.coursesPublished': -1 } : {}),
                },
            }
        );

        onCourseDeleted({
            courseId: id,
            instructorId: String(instructorId),
            categoryId,
        }).catch((err) => console.error('Cache invalidation error:', err));

        return res.json({ success: true, message: 'Course deleted successfully' });
    } catch (error) {
        console.error('Delete course error:', error);
        return next(error);
    }
};

module.exports = {
    createCourse,
    getAllCourses,
    getCourseById,
    getInstructorCourses,
    updateCourse,
    deleteCourse,
    fetchCourses,
};
