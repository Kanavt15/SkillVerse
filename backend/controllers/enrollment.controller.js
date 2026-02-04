const { pool } = require('../config/database');

// Enroll in a course
const enrollCourse = async (req, res) => {
  try {
    const { course_id } = req.body;
    const user_id = req.user.id;

    // Check if course exists and is published
    const [courses] = await pool.query(
      'SELECT id, is_published FROM courses WHERE id = ?',
      [course_id]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (!courses[0].is_published) {
      return res.status(400).json({
        success: false,
        message: 'Cannot enroll in unpublished course'
      });
    }

    // Check if already enrolled
    const [existingEnrollments] = await pool.query(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
      [user_id, course_id]
    );

    if (existingEnrollments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this course'
      });
    }

    // Create enrollment
    const [result] = await pool.query(
      'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
      [user_id, course_id]
    );

    // Get all lessons for the course to initialize progress
    const [lessons] = await pool.query(
      'SELECT id FROM lessons WHERE course_id = ?',
      [course_id]
    );

    // Create lesson progress entries
    if (lessons.length > 0) {
      const progressValues = lessons.map(lesson => [result.insertId, lesson.id]);
      await pool.query(
        'INSERT INTO lesson_progress (enrollment_id, lesson_id) VALUES ?',
        [progressValues]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Successfully enrolled in course',
      enrollment: {
        id: result.insertId,
        user_id,
        course_id,
        enrolled_at: new Date()
      }
    });
  } catch (error) {
    console.error('Enroll course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error enrolling in course'
    });
  }
};

// Get user's enrolled courses
const getEnrolledCourses = async (req, res) => {
  try {
    const user_id = req.user.id;

    const [enrollments] = await pool.query(
      `SELECT e.*, 
              c.title, c.description, c.thumbnail, c.difficulty_level,
              u.full_name as instructor_name,
              cat.name as category_name,
              COUNT(DISTINCT l.id) as total_lessons,
              COUNT(DISTINCT CASE WHEN lp.is_completed = true THEN lp.id END) as completed_lessons
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN users u ON c.instructor_id = u.id
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN lessons l ON c.id = l.course_id
       LEFT JOIN lesson_progress lp ON e.id = lp.enrollment_id
       WHERE e.user_id = ?
       GROUP BY e.id
       ORDER BY e.enrolled_at DESC`,
      [user_id]
    );

    res.json({
      success: true,
      count: enrollments.length,
      enrollments
    });
  } catch (error) {
    console.error('Get enrolled courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enrolled courses'
    });
  }
};

// Get course progress
const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const user_id = req.user.id;

    // Get enrollment
    const [enrollments] = await pool.query(
      'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
      [user_id, courseId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Not enrolled in this course'
      });
    }

    const enrollment = enrollments[0];

    // Get lesson progress
    const [progress] = await pool.query(
      `SELECT lp.*, l.title, l.lesson_order, l.duration_minutes
       FROM lesson_progress lp
       JOIN lessons l ON lp.lesson_id = l.id
       WHERE lp.enrollment_id = ?
       ORDER BY l.lesson_order`,
      [enrollment.id]
    );

    res.json({
      success: true,
      enrollment,
      progress
    });
  } catch (error) {
    console.error('Get course progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching course progress'
    });
  }
};

// Mark lesson as complete
const markLessonComplete = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { time_spent_minutes = 0 } = req.body;
    const user_id = req.user.id;

    // Get enrollment through lesson
    const [lessons] = await pool.query(
      `SELECT l.course_id, e.id as enrollment_id
       FROM lessons l
       JOIN enrollments e ON l.course_id = e.course_id
       WHERE l.id = ? AND e.user_id = ?`,
      [lessonId, user_id]
    );

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found or not enrolled in course'
      });
    }

    const { enrollment_id, course_id } = lessons[0];

    // Update lesson progress
    await pool.query(
      `UPDATE lesson_progress 
       SET is_completed = true, 
           completed_at = CURRENT_TIMESTAMP,
           time_spent_minutes = time_spent_minutes + ?
       WHERE enrollment_id = ? AND lesson_id = ?`,
      [time_spent_minutes, enrollment_id, lessonId]
    );

    // Calculate overall progress
    const [progressStats] = await pool.query(
      `SELECT 
         COUNT(*) as total_lessons,
         SUM(CASE WHEN is_completed = true THEN 1 ELSE 0 END) as completed_lessons
       FROM lesson_progress
       WHERE enrollment_id = ?`,
      [enrollment_id]
    );

    const progressPercentage = (progressStats[0].completed_lessons / progressStats[0].total_lessons) * 100;

    // Update enrollment progress
    const isCompleted = progressPercentage === 100;
    await pool.query(
      `UPDATE enrollments 
       SET progress_percentage = ?,
           completed_at = ${isCompleted ? 'CURRENT_TIMESTAMP' : 'NULL'}
       WHERE id = ?`,
      [progressPercentage, enrollment_id]
    );

    res.json({
      success: true,
      message: 'Lesson marked as complete',
      progress_percentage: progressPercentage
    });
  } catch (error) {
    console.error('Mark lesson complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking lesson as complete'
    });
  }
};

// Update lesson progress (time spent, last accessed)
const updateLessonProgress = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { time_spent_minutes = 0 } = req.body;
    const user_id = req.user.id;

    // Get enrollment
    const [lessons] = await pool.query(
      `SELECT e.id as enrollment_id
       FROM lessons l
       JOIN enrollments e ON l.course_id = e.course_id
       WHERE l.id = ? AND e.user_id = ?`,
      [lessonId, user_id]
    );

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found or not enrolled'
      });
    }

    // Update time spent
    await pool.query(
      `UPDATE lesson_progress 
       SET time_spent_minutes = time_spent_minutes + ?,
           last_accessed_at = CURRENT_TIMESTAMP
       WHERE enrollment_id = ? AND lesson_id = ?`,
      [time_spent_minutes, lessons[0].enrollment_id, lessonId]
    );

    res.json({
      success: true,
      message: 'Progress updated successfully'
    });
  } catch (error) {
    console.error('Update lesson progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating progress'
    });
  }
};

module.exports = {
  enrollCourse,
  getEnrolledCourses,
  getCourseProgress,
  markLessonComplete,
  updateLessonProgress
};
