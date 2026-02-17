const { pool } = require('../config/database');

// Enroll in a course
const enrollCourse = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { course_id } = req.body;
    const user_id = req.user.id;

    await connection.beginTransaction();

    // Check if course exists and is published, get points_cost
    const [courses] = await connection.query(
      'SELECT id, title, is_published, points_cost FROM courses WHERE id = ?',
      [course_id]
    );

    if (courses.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (!courses[0].is_published) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot enroll in unpublished course'
      });
    }

    // Check if already enrolled
    const [existingEnrollments] = await connection.query(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
      [user_id, course_id]
    );

    if (existingEnrollments.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this course'
      });
    }

    const pointsCost = courses[0].points_cost || 0;

    // Check user has enough points (skip for free courses)
    if (pointsCost > 0) {
      const [users] = await connection.query(
        'SELECT points FROM users WHERE id = ?',
        [user_id]
      );

      if (users[0].points < pointsCost) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Not enough points. You need ${pointsCost} points but only have ${users[0].points}.`,
          required: pointsCost,
          available: users[0].points
        });
      }

      // Deduct points
      await connection.query(
        'UPDATE users SET points = points - ? WHERE id = ?',
        [pointsCost, user_id]
      );

      // Record transaction
      await connection.query(
        'INSERT INTO point_transactions (user_id, amount, type, description, reference_id) VALUES (?, ?, ?, ?, ?)',
        [user_id, pointsCost, 'spent', `Enrolled in: ${courses[0].title}`, course_id]
      );
    }

    // Create enrollment
    const [result] = await connection.query(
      'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
      [user_id, course_id]
    );

    // Get all lessons for the course to initialize progress
    const [lessons] = await connection.query(
      'SELECT id FROM lessons WHERE course_id = ?',
      [course_id]
    );

    // Create lesson progress entries
    if (lessons.length > 0) {
      const progressValues = lessons.map(lesson => [result.insertId, lesson.id]);
      await connection.query(
        'INSERT INTO lesson_progress (enrollment_id, lesson_id) VALUES ?',
        [progressValues]
      );
    }

    // Get updated points balance
    const [updatedUser] = await connection.query(
      'SELECT points FROM users WHERE id = ?',
      [user_id]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: pointsCost > 0
        ? `Successfully enrolled! ${pointsCost} points spent.`
        : 'Successfully enrolled in free course!',
      enrollment: {
        id: result.insertId,
        user_id,
        course_id,
        enrolled_at: new Date()
      },
      points_spent: pointsCost,
      points_balance: updatedUser[0].points
    });
  } catch (error) {
    await connection.rollback();
    console.error('Enroll course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error enrolling in course'
    });
  } finally {
    connection.release();
  }
};

// Get user's enrolled courses
const getEnrolledCourses = async (req, res) => {
  try {
    const user_id = req.user.id;

    const [enrollments] = await pool.query(
      `SELECT e.*, 
              c.title, c.description, c.thumbnail, c.difficulty_level,
              c.points_cost, c.points_reward,
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
  const connection = await pool.getConnection();
  try {
    const { lessonId } = req.params;
    const { time_spent_minutes = 0 } = req.body;
    const user_id = req.user.id;

    await connection.beginTransaction();

    // Get enrollment through lesson
    const [lessons] = await connection.query(
      `SELECT l.course_id, e.id as enrollment_id
       FROM lessons l
       JOIN enrollments e ON l.course_id = e.course_id
       WHERE l.id = ? AND e.user_id = ?`,
      [lessonId, user_id]
    );

    if (lessons.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Lesson not found or not enrolled in course'
      });
    }

    const { enrollment_id, course_id } = lessons[0];

    // Update lesson progress
    await connection.query(
      `UPDATE lesson_progress 
       SET is_completed = true, 
           completed_at = CURRENT_TIMESTAMP,
           time_spent_minutes = time_spent_minutes + ?
       WHERE enrollment_id = ? AND lesson_id = ?`,
      [time_spent_minutes, enrollment_id, lessonId]
    );

    // Calculate overall progress
    const [progressStats] = await connection.query(
      `SELECT 
         COUNT(*) as total_lessons,
         SUM(CASE WHEN is_completed = true THEN 1 ELSE 0 END) as completed_lessons
       FROM lesson_progress
       WHERE enrollment_id = ?`,
      [enrollment_id]
    );

    const totalLessons = Number(progressStats[0].total_lessons) || 0;
    const completedLessons = Number(progressStats[0].completed_lessons) || 0;
    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Update enrollment progress
    const isCompleted = progressPercentage === 100;
    await connection.query(
      `UPDATE enrollments 
       SET progress_percentage = ?,
           completed_at = ${isCompleted ? 'CURRENT_TIMESTAMP' : 'NULL'}
       WHERE id = ?`,
      [progressPercentage, enrollment_id]
    );

    let pointsEarned = 0;
    let pointsBalance = 0;

    // If course is fully completed, award points
    if (isCompleted) {
      const [courseData] = await connection.query(
        'SELECT title, points_reward FROM courses WHERE id = ?',
        [course_id]
      );

      if (courseData.length > 0 && courseData[0].points_reward > 0) {
        pointsEarned = courseData[0].points_reward;

        // Add points to user
        await connection.query(
          'UPDATE users SET points = points + ? WHERE id = ?',
          [pointsEarned, user_id]
        );

        // Record transaction
        await connection.query(
          'INSERT INTO point_transactions (user_id, amount, type, description, reference_id) VALUES (?, ?, ?, ?, ?)',
          [user_id, pointsEarned, 'earned', `Completed: ${courseData[0].title}`, course_id]
        );
      }

      // Get updated balance
      const [updatedUser] = await connection.query(
        'SELECT points FROM users WHERE id = ?',
        [user_id]
      );
      pointsBalance = updatedUser[0].points;
    }

    await connection.commit();

    const response = {
      success: true,
      message: isCompleted
        ? `🎉 Course completed! You earned ${pointsEarned} points!`
        : 'Lesson marked as complete',
      progress_percentage: progressPercentage,
      course_completed: isCompleted
    };

    if (isCompleted) {
      response.points_earned = pointsEarned;
      response.points_balance = pointsBalance;
    }

    res.json(response);
  } catch (error) {
    await connection.rollback();
    console.error('Mark lesson complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking lesson as complete'
    });
  } finally {
    connection.release();
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
