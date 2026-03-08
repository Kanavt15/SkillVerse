const { pool } = require('../config/database');
const { validationResult } = require('express-validator');

// ─── Create a discussion post (question or reply) ───────────────────────────
const createPost = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { courseId } = req.params;
        const { content, parent_id, lesson_id } = req.body;
        const userId = req.user.id;

        await connection.beginTransaction();

        // Verify course exists
        const [courses] = await connection.query(
            'SELECT id, instructor_id FROM courses WHERE id = ?',
            [courseId]
        );
        if (courses.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const isInstructor = courses[0].instructor_id === userId;

        // Check enrollment (instructors of the course are also allowed)
        if (!isInstructor) {
            const [enrollments] = await connection.query(
                'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
                [userId, courseId]
            );
            if (enrollments.length === 0) {
                await connection.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'You must be enrolled in this course to participate in discussions'
                });
            }
        }

        // If lesson_id is provided, verify it belongs to the course
        if (lesson_id) {
            const [lessonRows] = await connection.query(
                'SELECT id FROM lessons WHERE id = ? AND course_id = ?',
                [lesson_id, courseId]
            );
            if (lessonRows.length === 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Lesson not found in this course' });
            }
        }

        // If replying, verify parent post exists and belongs to same course
        if (parent_id) {
            const [parentPost] = await connection.query(
                'SELECT id, course_id FROM discussion_posts WHERE id = ?',
                [parent_id]
            );
            if (parentPost.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Parent post not found' });
            }
            if (parentPost[0].course_id !== parseInt(courseId)) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Parent post belongs to a different course' });
            }
        }

        // Insert the post
        const [result] = await connection.query(
            `INSERT INTO discussion_posts (course_id, user_id, lesson_id, parent_id, content, is_instructor_reply)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [courseId, userId, lesson_id || null, parent_id || null, content, isInstructor]
        );

        await connection.commit();

        // Fetch created post with user info
        const [post] = await pool.query(
            `SELECT dp.*, u.full_name, u.profile_image
             FROM discussion_posts dp
             JOIN users u ON dp.user_id = u.id
             WHERE dp.id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: parent_id ? 'Reply posted successfully' : 'Question posted successfully',
            post: post[0]
        });
    } catch (error) {
        await connection.rollback();
        console.error('Create discussion post error:', error);
        res.status(500).json({ success: false, message: 'Error creating discussion post' });
    } finally {
        connection.release();
    }
};

// ─── Get paginated top-level posts for a course ─────────────────────────────
const getPosts = async (req, res) => {
    try {
        const { courseId } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;
        const sort = req.query.sort === 'popular' ? 'dp.upvote_count DESC' : 'dp.created_at DESC';
        const lessonId = req.query.lesson_id ? parseInt(req.query.lesson_id) : null;

        // Build lesson filter
        const lessonFilter = lessonId
            ? 'AND dp.lesson_id = ?'
            : 'AND dp.lesson_id IS NULL';
        const lessonParams = lessonId ? [courseId, lessonId] : [courseId];

        // Total count of top-level posts
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM discussion_posts dp WHERE dp.course_id = ? ${lessonFilter} AND dp.parent_id IS NULL`,
            lessonParams
        );
        const total = countResult[0].total;

        // Get top-level posts with user info and reply count
        const [posts] = await pool.query(
            `SELECT dp.*, u.full_name, u.profile_image,
                    (SELECT COUNT(*) FROM discussion_posts WHERE parent_id = dp.id) as reply_count
             FROM discussion_posts dp
             JOIN users u ON dp.user_id = u.id
             WHERE dp.course_id = ? ${lessonFilter} AND dp.parent_id IS NULL
             ORDER BY ${sort}
             LIMIT ? OFFSET ?`,
            [...lessonParams, limit, offset]
        );

        // For each post, fetch the latest 2 replies (preview)
        for (const post of posts) {
            const [replies] = await pool.query(
                `SELECT dp.*, u.full_name, u.profile_image
                 FROM discussion_posts dp
                 JOIN users u ON dp.user_id = u.id
                 WHERE dp.parent_id = ?
                 ORDER BY dp.created_at ASC
                 LIMIT 2`,
                [post.id]
            );
            post.latest_replies = replies;
        }

        // If user is authenticated, check which posts they've voted on
        const userId = req.user?.id;
        if (userId && posts.length > 0) {
            const postIds = posts.map(p => p.id);
            const allPostIds = [...postIds];
            posts.forEach(p => p.latest_replies.forEach(r => allPostIds.push(r.id)));

            if (allPostIds.length > 0) {
                const [votes] = await pool.query(
                    `SELECT post_id FROM discussion_votes WHERE user_id = ? AND post_id IN (?)`,
                    [userId, allPostIds]
                );
                const votedSet = new Set(votes.map(v => v.post_id));
                posts.forEach(p => {
                    p.user_has_voted = votedSet.has(p.id);
                    p.latest_replies.forEach(r => { r.user_has_voted = votedSet.has(r.id); });
                });
            }
        }

        res.json({
            success: true,
            posts,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalPosts: total,
                limit
            }
        });
    } catch (error) {
        console.error('Get discussion posts error:', error);
        res.status(500).json({ success: false, message: 'Error fetching discussion posts' });
    }
};

// ─── Get paginated replies for a post ────────────────────────────────────────
const getReplies = async (req, res) => {
    try {
        const { postId } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;

        // Verify parent post exists
        const [parentPost] = await pool.query(
            'SELECT id FROM discussion_posts WHERE id = ?',
            [postId]
        );
        if (parentPost.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        // Total reply count
        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM discussion_posts WHERE parent_id = ?',
            [postId]
        );
        const total = countResult[0].total;

        // Get paginated replies
        const [replies] = await pool.query(
            `SELECT dp.*, u.full_name, u.profile_image
             FROM discussion_posts dp
             JOIN users u ON dp.user_id = u.id
             WHERE dp.parent_id = ?
             ORDER BY dp.created_at ASC
             LIMIT ? OFFSET ?`,
            [postId, limit, offset]
        );

        // If user is authenticated, check their votes
        const userId = req.user?.id;
        if (userId && replies.length > 0) {
            const replyIds = replies.map(r => r.id);
            const [votes] = await pool.query(
                `SELECT post_id FROM discussion_votes WHERE user_id = ? AND post_id IN (?)`,
                [userId, replyIds]
            );
            const votedSet = new Set(votes.map(v => v.post_id));
            replies.forEach(r => { r.user_has_voted = votedSet.has(r.id); });
        }

        res.json({
            success: true,
            replies,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalReplies: total,
                limit
            }
        });
    } catch (error) {
        console.error('Get discussion replies error:', error);
        res.status(500).json({ success: false, message: 'Error fetching replies' });
    }
};

// ─── Update own post ─────────────────────────────────────────────────────────
const updatePost = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        // Verify ownership
        const [posts] = await pool.query(
            'SELECT id, user_id FROM discussion_posts WHERE id = ?',
            [postId]
        );
        if (posts.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        if (posts[0].user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Not authorized to edit this post' });
        }

        await pool.query(
            'UPDATE discussion_posts SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [content, postId]
        );

        // Fetch updated post
        const [updated] = await pool.query(
            `SELECT dp.*, u.full_name, u.profile_image
             FROM discussion_posts dp
             JOIN users u ON dp.user_id = u.id
             WHERE dp.id = ?`,
            [postId]
        );

        res.json({
            success: true,
            message: 'Post updated successfully',
            post: updated[0]
        });
    } catch (error) {
        console.error('Update discussion post error:', error);
        res.status(500).json({ success: false, message: 'Error updating post' });
    }
};

// ─── Delete own post ─────────────────────────────────────────────────────────
const deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        const [posts] = await pool.query(
            'SELECT id, user_id FROM discussion_posts WHERE id = ?',
            [postId]
        );
        if (posts.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        if (posts[0].user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
        }

        // ON DELETE CASCADE handles child replies and votes
        await pool.query('DELETE FROM discussion_posts WHERE id = ?', [postId]);

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete discussion post error:', error);
        res.status(500).json({ success: false, message: 'Error deleting post' });
    }
};

// ─── Toggle upvote (idempotent) ──────────────────────────────────────────────
const toggleVote = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        await connection.beginTransaction();

        // Verify post exists
        const [posts] = await connection.query(
            'SELECT id FROM discussion_posts WHERE id = ?',
            [postId]
        );
        if (posts.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        // Check if already voted
        const [existingVote] = await connection.query(
            'SELECT id FROM discussion_votes WHERE user_id = ? AND post_id = ?',
            [userId, postId]
        );

        let voted;
        if (existingVote.length > 0) {
            // Remove vote
            await connection.query('DELETE FROM discussion_votes WHERE id = ?', [existingVote[0].id]);
            await connection.query(
                'UPDATE discussion_posts SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = ?',
                [postId]
            );
            voted = false;
        } else {
            // Add vote
            await connection.query(
                'INSERT INTO discussion_votes (post_id, user_id) VALUES (?, ?)',
                [postId, userId]
            );
            await connection.query(
                'UPDATE discussion_posts SET upvote_count = upvote_count + 1 WHERE id = ?',
                [postId]
            );
            voted = true;
        }

        // Get updated count
        const [updatedPost] = await connection.query(
            'SELECT upvote_count FROM discussion_posts WHERE id = ?',
            [postId]
        );

        await connection.commit();

        res.json({
            success: true,
            voted,
            upvote_count: updatedPost[0].upvote_count
        });
    } catch (error) {
        await connection.rollback();
        console.error('Toggle vote error:', error);
        res.status(500).json({ success: false, message: 'Error toggling vote' });
    } finally {
        connection.release();
    }
};

module.exports = {
    createPost,
    getPosts,
    getReplies,
    updatePost,
    deletePost,
    toggleVote
};
