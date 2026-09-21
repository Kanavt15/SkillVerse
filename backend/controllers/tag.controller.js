/**
 * Tags.
 *
 * MySQL modelled this as `course_tags` plus a `course_tag_relations` join
 * table. The relation is now a `tags` array on the course, so the join table
 * disappears and "which courses have this tag" becomes an index lookup.
 *
 * `usageCount` is denormalized on the tag so the popular-tags query does not
 * have to count courses every time. It is maintained by the mutations here.
 */

const Tag = require('../models/Tag');
const Course = require('../models/Course');
const serialize = require('../serializers');
const { onCourseUpdated } = require('../services/cache.service');

const slugify = (name) => String(name)
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

/** Recount how many published courses carry each of the given tags. */
const recountTags = async (tagIds) => {
    if (!tagIds?.length) return;
    const counts = await Course.aggregate([
        { $match: { tags: { $in: tagIds } } },
        { $unwind: '$tags' },
        { $match: { tags: { $in: tagIds } } },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.count]));
    await Promise.all(tagIds.map((id) => Tag.updateOne(
        { _id: id },
        { $set: { usageCount: byId.get(String(id)) || 0 } }
    )));
};

/** Confirm the requester may modify this course's tags. */
const requireCourseOwnership = async (courseId, reqUser) => {
    const course = await Course.findById(courseId).select('instructor tags');
    if (!course) {
        return { error: { status: 404, body: { success: false, message: 'Course not found' } } };
    }
    if (!course.instructor.equals(reqUser.id) && reqUser.role !== 'admin') {
        return { error: { status: 403, body: { success: false, message: 'Not authorized to modify this course' } } };
    }
    return { course };
};

// ------------------------------------------------------------------
// GET /api/tags
// ------------------------------------------------------------------
const getAllTags = async (req, res, next) => {
    try {
        const search = (req.query.search || '').trim();
        // Was `LIKE '%term%'`; a prefix regex is at least index-assisted.
        const filter = search ? { name: { $regex: `^${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } } : {};

        const tags = await Tag.find(filter).sort({ usageCount: -1, name: 1 }).lean();

        return res.json({
            success: true,
            count: tags.length,
            tags: tags.map((t) => serialize.tag({ ...t, _id: t._id })),
        });
    } catch (error) {
        console.error('Get tags error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/tags/popular
// ------------------------------------------------------------------
const getPopularTags = async (req, res, next) => {
    try {
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const tags = await Tag.find({ usageCount: { $gt: 0 } })
            .sort({ usageCount: -1 })
            .limit(limit)
            .lean();

        return res.json({
            success: true,
            count: tags.length,
            tags: tags.map((t) => serialize.tag({ ...t, _id: t._id })),
        });
    } catch (error) {
        console.error('Get popular tags error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/tags/:id
// ------------------------------------------------------------------
const getTagById = async (req, res, next) => {
    try {
        const tag = await Tag.findById(req.params.id).lean();
        if (!tag) return res.status(404).json({ success: false, message: 'Tag not found' });
        return res.json({ success: true, tag: serialize.tag({ ...tag, _id: tag._id }) });
    } catch (error) {
        console.error('Get tag error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/tags
// ------------------------------------------------------------------
const createTag = async (req, res, next) => {
    try {
        const name = String(req.body.name || '').trim();
        if (!name) {
            return res.status(400).json({ success: false, message: 'Tag name is required' });
        }

        const slug = slugify(name);
        const existing = await Tag.findOne({ $or: [{ name }, { slug }] }).lean();
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Tag already exists',
                tag: serialize.tag({ ...existing, _id: existing._id }),
            });
        }

        const tag = await Tag.create({ name, slug });
        return res.status(201).json({
            success: true,
            message: 'Tag created successfully',
            tag: serialize.tag(tag),
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Tag already exists' });
        }
        console.error('Create tag error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/tags/:id
// ------------------------------------------------------------------
const updateTag = async (req, res, next) => {
    try {
        const name = String(req.body.name || '').trim();
        if (!name) {
            return res.status(400).json({ success: false, message: 'Tag name is required' });
        }

        const tag = await Tag.findByIdAndUpdate(
            req.params.id,
            { $set: { name, slug: slugify(name) } },
            { new: true, runValidators: true }
        );

        if (!tag) return res.status(404).json({ success: false, message: 'Tag not found' });

        return res.json({ success: true, message: 'Tag updated successfully', tag: serialize.tag(tag) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Another tag already uses that name' });
        }
        console.error('Update tag error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// DELETE /api/tags/:id
// ------------------------------------------------------------------
const deleteTag = async (req, res, next) => {
    try {
        const tag = await Tag.findByIdAndDelete(req.params.id);
        if (!tag) return res.status(404).json({ success: false, message: 'Tag not found' });

        // No join table to cascade; pull the reference out of every course.
        await Course.updateMany({ tags: tag._id }, { $pull: { tags: tag._id } });

        return res.json({ success: true, message: 'Tag deleted successfully' });
    } catch (error) {
        console.error('Delete tag error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/tags/course/:courseId
// ------------------------------------------------------------------
const getCourseTagsById = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.courseId).populate('tags').lean();
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

        const tags = (course.tags || []).map((t) => serialize.tag({ ...t, _id: t._id }));
        return res.json({ success: true, count: tags.length, tags });
    } catch (error) {
        console.error('Get course tags error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/tags/course/:courseId
// ------------------------------------------------------------------
const addTagToCourse = async (req, res, next) => {
    try {
        const { course, error } = await requireCourseOwnership(req.params.courseId, req.user);
        if (error) return res.status(error.status).json(error.body);

        const tagId = req.body.tag_id || req.body.tagId;
        const tag = await Tag.findById(tagId);
        if (!tag) return res.status(404).json({ success: false, message: 'Tag not found' });

        // $addToSet is the idempotent equivalent of INSERT IGNORE against the
        // old unique (course_id, tag_id) key.
        await Course.updateOne({ _id: course._id }, { $addToSet: { tags: tag._id } });
        await recountTags([tag._id]);

        onCourseUpdated({ courseId: String(course._id), instructorId: String(course.instructor) })
            .catch(() => {});

        return res.status(201).json({ success: true, message: 'Tag added to course' });
    } catch (error) {
        console.error('Add tag to course error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// DELETE /api/tags/course/:courseId/:tagId
// ------------------------------------------------------------------
const removeTagFromCourse = async (req, res, next) => {
    try {
        const { course, error } = await requireCourseOwnership(req.params.courseId, req.user);
        if (error) return res.status(error.status).json(error.body);

        const { tagId } = req.params;
        await Course.updateOne({ _id: course._id }, { $pull: { tags: tagId } });
        await recountTags([tagId]);

        onCourseUpdated({ courseId: String(course._id), instructorId: String(course.instructor) })
            .catch(() => {});

        return res.json({ success: true, message: 'Tag removed from course' });
    } catch (error) {
        console.error('Remove tag from course error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/tags/course/:courseId
// ------------------------------------------------------------------
const updateCourseTags = async (req, res, next) => {
    try {
        const { course, error } = await requireCourseOwnership(req.params.courseId, req.user);
        if (error) return res.status(error.status).json(error.body);

        const requested = Array.isArray(req.body.tag_ids) ? req.body.tag_ids : req.body.tagIds;
        if (!Array.isArray(requested)) {
            return res.status(400).json({ success: false, message: 'tag_ids must be an array' });
        }

        // Keep only ids that resolve to real tags.
        const found = await Tag.find({ _id: { $in: requested } }).select('_id').lean();
        const newIds = found.map((t) => t._id);
        const previousIds = course.tags || [];

        // Was DELETE-all + N inserts inside a transaction; one $set replaces it.
        await Course.updateOne({ _id: course._id }, { $set: { tags: newIds } });

        // Recount both the tags added and the ones removed.
        const touched = [...new Set([...previousIds, ...newIds].map(String))]
            .map((id) => found.find((f) => String(f._id) === id)?._id || previousIds.find((p) => String(p) === id));
        await recountTags(touched.filter(Boolean));

        onCourseUpdated({ courseId: String(course._id), instructorId: String(course.instructor) })
            .catch(() => {});

        const populated = await Course.findById(course._id).populate('tags').lean();

        return res.json({
            success: true,
            message: 'Course tags updated',
            tags: (populated.tags || []).map((t) => serialize.tag({ ...t, _id: t._id })),
        });
    } catch (error) {
        console.error('Update course tags error:', error);
        return next(error);
    }
};

module.exports = {
    getAllTags,
    getTagById,
    createTag,
    updateTag,
    deleteTag,
    getPopularTags,
    getCourseTagsById,
    addTagToCourse,
    removeTagFromCourse,
    updateCourseTags,
};
