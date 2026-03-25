const { pool } = require('../config/database');
const { validationResult } = require('express-validator');
const { createNotification } = require('./notification.controller');
const { cacheGetOrSet, CacheKeys, CacheTTL } = require('../utils/cache.utils');
const { onCourseCreated, onCourseUpdated, onCourseDeleted } = require('../services/cache.service');

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

    // Invalidate course caches
    onCourseCreated({
      courseId: result.insertId,
      instructorId: instructor_id,
      categoryId: category_id
    }).catch(err => console.error('Cache invalidation error:', err));

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

// Get all courses (with filters, sorting, pagination) - WITH CACHING
const getAllCourses = async (req, res) => {
  try {
    const { category_id, difficulty_level, search, instructor_id, sort_by } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));

    // Skip cache for search/instructor filter queries (too many variations)
    const useCache = !search && !instructor_id && !difficulty_level;

    if (useCache) {
      const cacheKey = CacheKeys.courseList(sort_by, category_id, page, limit);

      const { data, fromCache } = await cacheGetOrSet(
        cacheKey,
        CacheTTL.COURSE_LIST,
        async () => fetchCoursesFromDB({ category_id, sort_by }, page, limit)
      );

      res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
      return res.json(data);
    }

    // No caching for filtered/searched results
    const data = await fetchCoursesFromDB(req.query, page, limit);
    res.set('X-Cache', 'BYPASS');
    return res.json(data);

  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching courses'
    });
  }
};

// Extract DB fetching logic to reusable function
async function fetchCoursesFromDB(queryParams, page, limit) {
  const { category_id, difficulty_level, search, instructor_id, sort_by } = queryParams;
  const offset = (page - 1) * limit;

  let baseWhere = 'WHERE c.is_published = true';
  const params = [];

  if (category_id) {
    baseWhere += ' AND c.category_id = ?';
    params.push(category_id);
  }
  if (difficulty_level) {
    baseWhere += ' AND c.difficulty_level = ?';
    params.push(difficulty_level);
  }
  if (instructor_id) {
    baseWhere += ' AND c.instructor_id = ?';
    params.push(instructor_id);
  }
  if (search) {
    baseWhere += ' AND (c.title LIKE ? OR c.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  // Count total matching courses
  const [countResult] = await pool.query(
    `SELECT COUNT(DISTINCT c.id) as total FROM courses c ${baseWhere}`,
    params
  );
  const total = countResult[0].total;

  // Determine sort order
  let orderBy;
  switch (sort_by) {
    case 'rating':
      orderBy = 'c.avg_rating DESC, c.review_count DESC';
      break;
    case 'popular':
      orderBy = 'enrollment_count DESC';
      break;
    case 'newest':
    default:
      orderBy = 'c.created_at DESC';
      break;
  }

  const query = `
    SELECT c.id, c.instructor_id, c.category_id, c.title, c.description,
           c.thumbnail, c.difficulty_level, c.points_cost, c.points_reward,
           c.duration_hours, c.is_published, c.avg_rating, c.review_count,
           c.created_at, c.updated_at,
           u.full_name as instructor_name,
           cat.name as category_name,
           COUNT(DISTINCT l.id) as lesson_count,
           COUNT(DISTINCT e.id) as enrollment_count
    FROM courses c
    LEFT JOIN users u ON c.instructor_id = u.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN lessons l ON c.id = l.course_id
    LEFT JOIN enrollments e ON c.id = e.course_id
    ${baseWhere}
    GROUP BY c.id
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const [courses] = await pool.query(query, [...params, limit, offset]);

  return {
    success: true,
    count: courses.length,
    courses,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCourses: total,
      limit
    }
  };
}

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
              COUNT(DISTINCT e.id) as enrollment_count
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN lessons l ON c.id = l.course_id
       LEFT JOIN enrollments e ON c.id = e.course_id
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

    // If the course was just published, notify all followers of the instructor
    if (is_published === true || is_published === 'true' || is_published === 1) {
      const courseTitle = updatedCourse[0]?.title || title || 'a new course';
      pool.query(
        'SELECT follower_id FROM followers WHERE following_id = ?',
        [instructor_id]
      ).then(([followers]) => {
        followers.forEach(({ follower_id }) => {
          createNotification(
            follower_id,
            'new_lesson',
            'New Course from an Instructor You Follow',
            `${req.user.full_name || 'An instructor you follow'} published a new course: "${courseTitle}"`,
            parseInt(id)
          ).catch(() => { });
        });
      }).catch(() => { });
    }

    // Invalidate course caches
    onCourseUpdated({
      courseId: parseInt(id),
      instructorId: instructor_id,
      categoryId: updatedCourse[0]?.category_id
    }).catch(err => console.error('Cache invalidation error:', err));

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
      'SELECT instructor_id, category_id FROM courses WHERE id = ?',
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

    const categoryId = courses[0].category_id;

    await pool.query('DELETE FROM courses WHERE id = ?', [id]);

    // Invalidate course caches
    onCourseDeleted({
      courseId: parseInt(id),
      instructorId: instructor_id,
      categoryId: categoryId
    }).catch(err => console.error('Cache invalidation error:', err));

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
