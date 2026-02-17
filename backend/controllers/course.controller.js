const { pool } = require('../config/database');
const { validationResult } = require('express-validator');

// Create new course
const createCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, category_id, difficulty_level, points_cost, points_reward } = req.body;
    const instructor_id = req.user.id;
    const thumbnail = req.file ? `/uploads/thumbnails/${req.file.filename}` : null;

    // Auto-calculate points based on difficulty if not provided
    const difficultyDefaults = {
      beginner: { cost: 50, reward: 75 },
      intermediate: { cost: 100, reward: 150 },
      advanced: { cost: 200, reward: 300 }
    };
    const defaults = difficultyDefaults[difficulty_level] || difficultyDefaults.beginner;
    const finalCost = points_cost !== undefined ? parseInt(points_cost) : defaults.cost;
    const finalReward = points_reward !== undefined ? parseInt(points_reward) : defaults.reward;

    const [result] = await pool.query(
      `INSERT INTO courses (instructor_id, category_id, title, description, difficulty_level, points_cost, points_reward, thumbnail) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [instructor_id, category_id, title, description, difficulty_level, finalCost, finalReward, thumbnail]
    );

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course: {
        id: result.insertId,
        instructor_id,
        category_id,
        title,
        description,
        difficulty_level,
        points_cost: finalCost,
        points_reward: finalReward,
        thumbnail
      }
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating course'
    });
  }
};

// Get all courses (with filters)
const getAllCourses = async (req, res) => {
  try {
    const { category_id, difficulty_level, search, instructor_id } = req.query;

    let query = `
      SELECT c.id, c.instructor_id, c.category_id, c.title, c.description, 
             c.thumbnail, c.difficulty_level, c.points_cost, c.points_reward,
             c.duration_hours, c.is_published, c.created_at, c.updated_at,
             u.full_name as instructor_name,
             cat.name as category_name,
             COUNT(DISTINCT l.id) as lesson_count,
             COUNT(DISTINCT e.id) as enrollment_count
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN lessons l ON c.id = l.course_id
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.is_published = true
    `;

    const params = [];

    if (category_id) {
      query += ' AND c.category_id = ?';
      params.push(category_id);
    }

    if (difficulty_level) {
      query += ' AND c.difficulty_level = ?';
      params.push(difficulty_level);
    }

    if (instructor_id) {
      query += ' AND c.instructor_id = ?';
      params.push(instructor_id);
    }

    if (search) {
      query += ' AND (c.title LIKE ? OR c.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' GROUP BY c.id ORDER BY c.created_at DESC';

    const [courses] = await pool.query(query, params);

    res.json({
      success: true,
      count: courses.length,
      courses
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching courses'
    });
  }
};

// Get single course by ID
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const [courses] = await pool.query(
      `SELECT c.*, 
              u.full_name as instructor_name,
              u.bio as instructor_bio,
              cat.name as category_name,
              COUNT(DISTINCT l.id) as lesson_count,
              COUNT(DISTINCT e.id) as enrollment_count,
              AVG(r.rating) as average_rating,
              COUNT(DISTINCT r.id) as review_count
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN lessons l ON c.id = l.course_id
       LEFT JOIN enrollments e ON c.id = e.course_id
       LEFT JOIN reviews r ON c.id = r.course_id
       WHERE c.id = ?
       GROUP BY c.id`,
      [id]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get lessons for this course
    const [lessons] = await pool.query(
      'SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_order',
      [id]
    );

    res.json({
      success: true,
      course: {
        ...courses[0],
        lessons
      }
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching course'
    });
  }
};

// Get instructor's courses
const getInstructorCourses = async (req, res) => {
  try {
    const instructor_id = req.user.id;

    const [courses] = await pool.query(
      `SELECT c.*, 
              cat.name as category_name,
              COUNT(DISTINCT l.id) as lesson_count,
              COUNT(DISTINCT e.id) as enrollment_count
       FROM courses c
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN lessons l ON c.id = l.course_id
       LEFT JOIN enrollments e ON c.id = e.course_id
       WHERE c.instructor_id = ?
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [instructor_id]
    );

    res.json({
      success: true,
      count: courses.length,
      courses
    });
  } catch (error) {
    console.error('Get instructor courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching instructor courses'
    });
  }
};

// Update course
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category_id, difficulty_level, price, is_published } = req.body;
    const instructor_id = req.user.id;

    // Verify ownership
    const [courses] = await pool.query(
      'SELECT instructor_id FROM courses WHERE id = ?',
      [id]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (courses[0].instructor_id !== instructor_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this course'
      });
    }

    const updates = [];
    const values = [];

    if (title) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (category_id) {
      updates.push('category_id = ?');
      values.push(category_id);
    }
    if (difficulty_level) {
      updates.push('difficulty_level = ?');
      values.push(difficulty_level);
    }
    if (price !== undefined) {
      updates.push('points_cost = ?');
      values.push(price);
    }
    if (req.body.points_cost !== undefined) {
      updates.push('points_cost = ?');
      values.push(req.body.points_cost);
    }
    if (req.body.points_reward !== undefined) {
      updates.push('points_reward = ?');
      values.push(req.body.points_reward);
    }
    if (is_published !== undefined) {
      updates.push('is_published = ?');
      values.push(is_published);
    }
    if (req.file) {
      updates.push('thumbnail = ?');
      values.push(`/uploads/thumbnails/${req.file.filename}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(id);

    await pool.query(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated course
    const [updatedCourse] = await pool.query(
      'SELECT * FROM courses WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Course updated successfully',
      course: updatedCourse[0]
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating course'
    });
  }
};

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const instructor_id = req.user.id;

    // Verify ownership
    const [courses] = await pool.query(
      'SELECT instructor_id FROM courses WHERE id = ?',
      [id]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (courses[0].instructor_id !== instructor_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this course'
      });
    }

    await pool.query('DELETE FROM courses WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting course'
    });
  }
};

module.exports = {
  createCourse,
  getAllCourses,
  getCourseById,
  getInstructorCourses,
  updateCourse,
  deleteCourse
};
