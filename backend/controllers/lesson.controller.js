const { pool } = require('../config/database');
const { validationResult } = require('express-validator');

// Create lesson
const createLesson = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Get course_id from body or params (for nested route)
    const course_id = req.body.course_id || req.params.id;
    const { title, description, lesson_order, video_url, duration_minutes, content, is_free = false } = req.body;
    const instructor_id = req.user.id;
    
    // Convert is_free to boolean (FormData sends it as string)
    const isFreeBoolean = is_free === 'true' || is_free === true ? 1 : 0;
    
    // Use uploaded video file if available, otherwise use video_url
    const videoPath = req.file ? `/uploads/videos/${req.file.filename}` : (video_url || null);

    // Verify course ownership
    const [courses] = await pool.query(
      'SELECT instructor_id FROM courses WHERE id = ?',
      [course_id]
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
        message: 'Not authorized to add lessons to this course'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO lessons (course_id, title, description, lesson_order, video_url, duration_minutes, content, is_free) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [course_id, title, description, lesson_order, videoPath, duration_minutes, content, isFreeBoolean]
    );

    res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      lesson: {
        id: result.insertId,
        course_id,
        title,
        description,
        lesson_order,
        video_url: videoPath,
        duration_minutes,
        content,
        is_free
      }
    });
  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating lesson'
    });
  }
};

// Get lessons for a course
const getCourseLessons = async (req, res) => {
  try {
    const { courseId } = req.params;

    const [lessons] = await pool.query(
      `SELECT l.*,
              COUNT(lr.id) as resource_count
       FROM lessons l
       LEFT JOIN lesson_resources lr ON l.id = lr.lesson_id
       WHERE l.course_id = ?
       GROUP BY l.id
       ORDER BY l.lesson_order`,
      [courseId]
    );

    res.json({
      success: true,
      count: lessons.length,
      lessons
    });
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching lessons'
    });
  }
};

// Get single lesson
const getLessonById = async (req, res) => {
  try {
    const { id } = req.params;

    const [lessons] = await pool.query(
      `SELECT l.*, c.instructor_id, c.title as course_title
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ?`,
      [id]
    );

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Get resources for this lesson
    const [resources] = await pool.query(
      'SELECT * FROM lesson_resources WHERE lesson_id = ?',
      [id]
    );

    res.json({
      success: true,
      lesson: {
        ...lessons[0],
        resources
      }
    });
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching lesson'
    });
  }
};

// Update lesson
const updateLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, lesson_order, video_url, duration_minutes, content, is_free } = req.body;
    const instructor_id = req.user.id;

    // Verify ownership through course
    const [lessons] = await pool.query(
      `SELECT l.*, c.instructor_id 
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ?`,
      [id]
    );

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    if (lessons[0].instructor_id !== instructor_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this lesson'
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
    if (lesson_order) {
      updates.push('lesson_order = ?');
      values.push(lesson_order);
    }
    if (video_url !== undefined) {
      updates.push('video_url = ?');
      values.push(video_url);
    }
    if (req.file) {
      updates.push('video_url = ?');
      values.push(`/uploads/videos/${req.file.filename}`);
    }
    if (duration_minutes) {
      updates.push('duration_minutes = ?');
      values.push(duration_minutes);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    if (is_free !== undefined) {
      updates.push('is_free = ?');
      // Convert is_free to boolean (FormData sends it as string)
      const isFreeBoolean = is_free === 'true' || is_free === true ? 1 : 0;
      values.push(isFreeBoolean);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(id);

    await pool.query(
      `UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated lesson
    const [updatedLesson] = await pool.query(
      'SELECT * FROM lessons WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Lesson updated successfully',
      lesson: updatedLesson[0]
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating lesson'
    });
  }
};

// Delete lesson
const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const instructor_id = req.user.id;

    // Verify ownership through course
    const [lessons] = await pool.query(
      `SELECT l.*, c.instructor_id 
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ?`,
      [id]
    );

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    if (lessons[0].instructor_id !== instructor_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this lesson'
      });
    }

    await pool.query('DELETE FROM lessons WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Lesson deleted successfully'
    });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting lesson'
    });
  }
};

module.exports = {
  createLesson,
  getCourseLessons,
  getLessonById,
  updateLesson,
  deleteLesson
};
