const { pool } = require('../config/database');
const { validationResult } = require('express-validator');

// Helper: recalculate avg_rating & review_count on courses table
const _recalcAggregates = async (connection, courseId) => {
    await connection.query(
        `UPDATE courses SET
       avg_rating = COALESCE((SELECT AVG(rating) FROM reviews WHERE course_id = ?), 0),
       review_count = (SELECT COUNT(*) FROM reviews WHERE course_id = ?)
     WHERE id = ?`,
        [courseId, courseId, courseId]
    );
};

// Create a review
const createReview = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { courseId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        await connection.beginTransaction();

        // Check course exists
        const [courses] = await connection.query(
            'SELECT id, instructor_id FROM courses WHERE id = ?',
            [courseId]
        );
        if (courses.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        // Instructor cannot review own course
        if (courses[0].instructor_id === userId) {
            await connection.rollback();
            return res.status(403).json({
                success: false,
                message: 'Instructors cannot review their own courses'
            });
        }

        // Check enrollment
        const [enrollments] = await connection.query(
            'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );
        if (enrollments.length === 0) {
            await connection.rollback();
            return res.status(403).json({
                success: false,
                message: 'You must be enrolled in this course to leave a review'
            });
        }

        // Check for existing review (UNIQUE constraint will also catch this)
        const [existing] = await connection.query(
            'SELECT id FROM reviews WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: 'You have already reviewed this course. You can edit your existing review.'
            });
        }

        // Insert review
        const [result] = await connection.query(
            'INSERT INTO reviews (user_id, course_id, rating, comment) VALUES (?, ?, ?, ?)',
            [userId, courseId, rating, comment || null]
        );

        // Recalculate aggregates
        await _recalcAggregates(connection, courseId);

        await connection.commit();

        // Fetch the created review with user info
        const [review] = await pool.query(
            `SELECT r.*, u.full_name, u.profile_image
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            review: review[0]
        });
    } catch (error) {
        await connection.rollback();
        console.error('Create review error:', error);
        res.status(500).json({ success: false, message: 'Error creating review' });
    } finally {
        connection.release();
    }
};

// Update a review
const updateReview = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { id } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        await connection.beginTransaction();

        // Verify ownership
        const [reviews] = await connection.query(
            'SELECT id, course_id, user_id FROM reviews WHERE id = ?',
            [id]
        );
        if (reviews.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Review not found' });
        }
        if (reviews[0].user_id !== userId) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: 'Not authorized to edit this review' });
        }

        const courseId = reviews[0].course_id;

        // Update
        await connection.query(
            'UPDATE reviews SET rating = ?, comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [rating, comment || null, id]
        );

        // Recalculate aggregates
        await _recalcAggregates(connection, courseId);

        await connection.commit();

        // Fetch updated review
        const [updated] = await pool.query(
            `SELECT r.*, u.full_name, u.profile_image
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
            [id]
        );

        res.json({
            success: true,
            message: 'Review updated successfully',
            review: updated[0]
        });
    } catch (error) {
        await connection.rollback();
        console.error('Update review error:', error);
        res.status(500).json({ success: false, message: 'Error updating review' });
    } finally {
        connection.release();
    }
};

// Delete a review
const deleteReview = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await connection.beginTransaction();

        // Verify ownership
        const [reviews] = await connection.query(
            'SELECT id, course_id, user_id FROM reviews WHERE id = ?',
            [id]
        );
        if (reviews.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Review not found' });
        }
        if (reviews[0].user_id !== userId) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: 'Not authorized to delete this review' });
        }

        const courseId = reviews[0].course_id;

        await connection.query('DELETE FROM reviews WHERE id = ?', [id]);

        // Recalculate aggregates
        await _recalcAggregates(connection, courseId);

        await connection.commit();

        res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Delete review error:', error);
        res.status(500).json({ success: false, message: 'Error deleting review' });
    } finally {
        connection.release();
    }
};

// Get paginated reviews for a course
const getCourseReviews = async (req, res) => {
    try {
        const { courseId } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 5));
        const offset = (page - 1) * limit;

        // Get total count
        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM reviews WHERE course_id = ?',
            [courseId]
        );
        const total = countResult[0].total;

        // Get rating distribution
        const [distribution] = await pool.query(
            `SELECT rating, COUNT(*) as count
       FROM reviews WHERE course_id = ?
       GROUP BY rating ORDER BY rating DESC`,
            [courseId]
        );

        // Get paginated reviews
        const [reviews] = await pool.query(
            `SELECT r.*, u.full_name, u.profile_image
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.course_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
            [courseId, limit, offset]
        );

        // Build distribution map (1-5)
        const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        distribution.forEach(d => { ratingDistribution[d.rating] = d.count; });

        res.json({
            success: true,
            reviews,
            ratingDistribution,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalReviews: total,
                limit
            }
        });
    } catch (error) {
        console.error('Get course reviews error:', error);
        res.status(500).json({ success: false, message: 'Error fetching reviews' });
    }
};

// Get the authenticated user's review for a course
const getUserReview = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user.id;

        const [reviews] = await pool.query(
            `SELECT r.*, u.full_name, u.profile_image
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.user_id = ? AND r.course_id = ?`,
            [userId, courseId]
        );

        if (reviews.length === 0) {
            return res.json({ success: true, review: null });
        }

        res.json({ success: true, review: reviews[0] });
    } catch (error) {
        console.error('Get user review error:', error);
        res.status(500).json({ success: false, message: 'Error fetching your review' });
    }
};

module.exports = {
    createReview,
    updateReview,
    deleteReview,
    getCourseReviews,
    getUserReview
};
