/**
 * Threaded course discussions.
 *
 * Two things carry over carefully from the MySQL version:
 *
 *   - Deleting a question must remove its entire reply subtree. That was
 *     `ON DELETE CASCADE` on a self-referencing FK; the DiscussionPost model
 *     declares itself as its own cascade child, which recurses to any depth.
 *
 *   - `upvoteCount` is denormalized on the post while DiscussionVote holds the
 *     authoritative rows. The decrement uses a guarded `$inc` in place of
 *     `GREATEST(upvote_count - 1, 0)` so a double-unvote cannot push it below
 *     zero.
 */

const { validationResult } = require('express-validator');

const DiscussionPost = require('../models/DiscussionPost');
const DiscussionVote = require('../models/DiscussionVote');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { withTransaction } = require('../config/mongo');
const { checkAndAwardBadges } = require('../services/badge.service');

/** Post -> legacy response shape (flat author fields). */
const toLegacy = (p) => {
    const author = p.author && typeof p.author === 'object' && p.author.fullName ? p.author : null;
    return {
        id: String(p._id),
        _id: String(p._id),
        course_id: String(p.course?._id || p.course),
        user_id: String(author ? author._id : p.author),
        lesson_id: p.lesson ? String(p.lesson._id || p.lesson) : null,
        parent_id: p.parent ? String(p.parent._id || p.parent) : null,
        content: p.content,
        is_instructor_reply: p.isInstructorReply,
        upvote_count: p.upvoteCount ?? 0,
        full_name: author?.fullName || null,
        profile_image: author?.profileImage || null,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
    };
};

const AUTHOR_FIELDS = 'fullName profileImage username';

/** Load a post and confirm the requester may modify it. */
const requireOwnPost = async (postId, reqUser) => {
    const post = await DiscussionPost.findById(postId);
    if (!post) {
        return { error: { status: 404, body: { success: false, message: 'Post not found' } } };
    }
    if (!post.author.equals(reqUser.id) && reqUser.role !== 'admin') {
        return { error: { status: 403, body: { success: false, message: 'Not authorized to modify this post' } } };
    }
    return { post };
};

// ------------------------------------------------------------------
// POST /api/discussions/course/:courseId
// ------------------------------------------------------------------
const createPost = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { courseId } = req.params;
        const { content, parent_id: parentId, lesson_id: lessonId } = req.body;
        const userId = req.user.id;

        const course = await Course.findById(courseId).select('instructor');
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const isInstructor = course.instructor.equals(userId);

        // The course's own instructor participates without enrolling.
        if (!isInstructor) {
            if (!await Enrollment.exists({ user: userId, course: courseId })) {
                return res.status(403).json({
                    success: false,
                    message: 'You must be enrolled in this course to participate in discussions',
                });
            }
        }

        if (lessonId) {
            if (!await Lesson.exists({ _id: lessonId, course: courseId })) {
                return res.status(400).json({ success: false, message: 'Lesson not found in this course' });
            }
        }

        if (parentId) {
            const parent = await DiscussionPost.findById(parentId).select('course');
            if (!parent) {
                return res.status(404).json({ success: false, message: 'Parent post not found' });
            }
            // Stops a reply being grafted onto a thread in another course.
            if (!parent.course.equals(courseId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Parent post belongs to a different course',
                });
            }
        }

        const post = await DiscussionPost.create({
            course: courseId,
            author: userId,
            lesson: lessonId || null,
            parent: parentId || null,
            content,
            isInstructorReply: isInstructor,
        });

        await User.updateOne(
            { _id: userId },
            { $inc: { 'learningStats.discussionsPosted': 1 } }
        );
        checkAndAwardBadges(userId, {}).catch(() => {});

        const populated = await DiscussionPost.findById(post._id).populate('author', AUTHOR_FIELDS);

        return res.status(201).json({
            success: true,
            message: parentId ? 'Reply posted successfully' : 'Question posted successfully',
            post: toLegacy(populated),
        });
    } catch (error) {
        console.error('Create discussion post error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/discussions/course/:courseId
// ------------------------------------------------------------------
const getPosts = async (req, res, next) => {
    try {
        const { courseId } = req.params;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));

        // Course-level threads have no lesson; lesson-level ones are filtered
        // to that lesson. Matches the SQL's `lesson_id IS NULL` default.
        const filter = {
            course: courseId,
            parent: null,
            lesson: req.query.lesson_id || null,
        };

        const sort = req.query.sort === 'popular'
            ? { upvoteCount: -1, createdAt: -1 }
            : { createdAt: -1 };

        const [posts, total] = await Promise.all([
            DiscussionPost.find(filter)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('author', AUTHOR_FIELDS)
                .lean(),
            DiscussionPost.countDocuments(filter),
        ]);

        const postIds = posts.map((p) => p._id);

        // Reply counts and preview replies for the whole page in two queries,
        // rather than the N+1 loop the SQL version ran.
        const [replyCounts, previewReplies] = await Promise.all([
            DiscussionPost.aggregate([
                { $match: { parent: { $in: postIds } } },
                { $group: { _id: '$parent', count: { $sum: 1 } } },
            ]),
            DiscussionPost.find({ parent: { $in: postIds } })
                .sort({ createdAt: 1 })
                .populate('author', AUTHOR_FIELDS)
                .lean(),
        ]);

        const countByParent = new Map(replyCounts.map((c) => [String(c._id), c.count]));
        const repliesByParent = new Map();
        previewReplies.forEach((r) => {
            const key = String(r.parent);
            const list = repliesByParent.get(key) || [];
            if (list.length < 2) list.push(r);
            repliesByParent.set(key, list);
        });

        // Which of these the viewer has already upvoted.
        let votedSet = new Set();
        if (req.user?.id) {
            const allIds = [...postIds, ...previewReplies.map((r) => r._id)];
            const votes = await DiscussionVote.find({
                user: req.user.id,
                post: { $in: allIds },
            }).select('post').lean();
            votedSet = new Set(votes.map((v) => String(v.post)));
        }

        const shaped = posts.map((p) => {
            const replies = (repliesByParent.get(String(p._id)) || []).map((r) => ({
                ...toLegacy(r),
                user_has_voted: votedSet.has(String(r._id)),
            }));
            return {
                ...toLegacy(p),
                reply_count: countByParent.get(String(p._id)) || 0,
                latest_replies: replies,
                user_has_voted: votedSet.has(String(p._id)),
            };
        });

        return res.json({
            success: true,
            posts: shaped,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalPosts: total,
                limit,
            },
        });
    } catch (error) {
        console.error('Get discussion posts error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/discussions/:postId/replies
// ------------------------------------------------------------------
const getReplies = async (req, res, next) => {
    try {
        const { postId } = req.params;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));

        if (!await DiscussionPost.exists({ _id: postId })) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        const filter = { parent: postId };

        const [replies, total] = await Promise.all([
            DiscussionPost.find(filter)
                .sort({ createdAt: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('author', AUTHOR_FIELDS)
                .lean(),
            DiscussionPost.countDocuments(filter),
        ]);

        let votedSet = new Set();
        if (req.user?.id && replies.length) {
            const votes = await DiscussionVote.find({
                user: req.user.id,
                post: { $in: replies.map((r) => r._id) },
            }).select('post').lean();
            votedSet = new Set(votes.map((v) => String(v.post)));
        }

        return res.json({
            success: true,
            replies: replies.map((r) => ({
                ...toLegacy(r),
                user_has_voted: votedSet.has(String(r._id)),
            })),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalReplies: total,
                limit,
            },
        });
    } catch (error) {
        console.error('Get replies error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/discussions/:postId
// ------------------------------------------------------------------
const updatePost = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { post, error } = await requireOwnPost(req.params.postId, req.user);
        if (error) return res.status(error.status).json(error.body);

        post.content = req.body.content;
        await post.save();

        const populated = await DiscussionPost.findById(post._id).populate('author', AUTHOR_FIELDS);

        return res.json({
            success: true,
            message: 'Post updated successfully',
            post: toLegacy(populated),
        });
    } catch (error) {
        console.error('Update discussion post error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// DELETE /api/discussions/:postId
// ------------------------------------------------------------------
const deletePost = async (req, res, next) => {
    try {
        const { post, error } = await requireOwnPost(req.params.postId, req.user);
        if (error) return res.status(error.status).json(error.body);

        const authorId = post.author;

        // The cascade plugin removes the reply subtree and every vote on it.
        await DiscussionPost.findByIdAndDelete(post._id);

        await User.updateOne(
            { _id: authorId },
            { $inc: { 'learningStats.discussionsPosted': -1 } }
        );

        return res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete discussion post error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/discussions/:postId/vote
// ------------------------------------------------------------------
const toggleVote = async (req, res, next) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        const post = await DiscussionPost.findById(postId).select('author upvoteCount');
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        const result = await withTransaction(async (session) => {
            const existing = await DiscussionVote.findOne({ user: userId, post: postId }).session(session);

            if (existing) {
                await DiscussionVote.deleteOne({ _id: existing._id }, { session });
                // Guarded: only decrement while above zero, replacing
                // GREATEST(upvote_count - 1, 0).
                await DiscussionPost.updateOne(
                    { _id: postId, upvoteCount: { $gt: 0 } },
                    { $inc: { upvoteCount: -1 } },
                    { session }
                );
                await User.updateOne(
                    { _id: post.author },
                    { $inc: { 'learningStats.helpfulAnswers': -1 } },
                    { session }
                );
                return false;
            }

            await DiscussionVote.create([{ user: userId, post: postId }], { session });
            await DiscussionPost.updateOne(
                { _id: postId },
                { $inc: { upvoteCount: 1 } },
                { session }
            );
            await User.updateOne(
                { _id: post.author },
                { $inc: { 'learningStats.helpfulAnswers': 1 } },
                { session }
            );
            return true;
        });

        const updated = await DiscussionPost.findById(postId).select('upvoteCount').lean();

        if (result) checkAndAwardBadges(String(post.author), {}).catch(() => {});

        return res.json({
            success: true,
            voted: result,
            upvote_count: updated?.upvoteCount ?? 0,
        });
    } catch (error) {
        // A duplicate vote lost a race; report current state rather than 500.
        if (error.code === 11000) {
            const updated = await DiscussionPost.findById(req.params.postId).select('upvoteCount').lean();
            return res.json({ success: true, voted: true, upvote_count: updated?.upvoteCount ?? 0 });
        }
        console.error('Toggle vote error:', error);
        return next(error);
    }
};

module.exports = {
    createPost,
    getPosts,
    getReplies,
    updatePost,
    deletePost,
    toggleVote,
};
