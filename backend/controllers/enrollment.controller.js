const { pool } = require('../config/database');
const { createCertificateRecord } = require('./certificate.controller');
const { createNotification } = require('./notification.controller');
const { validateLessonCompletion } = require('../services/antiCheat.service');
const { updateStreakOnActivity, updateDailyXP } = require('../services/streak.service');
const { awardLessonXP, awardCourseXP, awardStreakBonusXP } = require('../services/xp.service');
const { checkAndAwardBadges } = require('../services/badge.service');
const { emitToUser } = require('../socket');
const { onEnrollmentCreated } = require('../services/cache.service');

// Enroll in a course
const enrollCourse = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { course_id } = req.body;
    const user_id = req.user.id;

    await connection.beginTransaction();

    // Check if course exists and is published, get points_cost
    const [courses] = await connection.query(
      'SELECT id, title, is_published, points_cost, instructor_id FROM courses WHERE id = ?',
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

    // Notify the instructor about the new enrollment (fire and forget)
    createNotification(
      courses[0].instructor_id,
      'enrollment',
      'New Enrollment',
      `A learner enrolled in your course: ${courses[0].title}`,
      course_id
    ).catch(() => { });

    // Invalidate course caches (fire and forget)
    onEnrollmentCreated({
      courseId: course_id,
      instructorId: courses[0].instructor_id,
      userId: user_id
    }).catch(err => console.error('Cache invalidation error:', err));

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

// Mark lesson as complete (GAMIFIED VERSION)
const markLessonComplete = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { lessonId } = req.params;
    const { time_spent_minutes = 0 } = req.body;
    const user_id = req.user.id;

    // Anti-cheat validation
    const validationMetadata = {
      timeSpentSeconds: time_spent_minutes * 60,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };

    const antiCheatResult = await validateLessonCompletion(
      connection,
      user_id,
      lessonId,
      validationMetadata
    );

    if (!antiCheatResult.allowed) {
      return res.status(400).json({
        success: false,
        message: antiCheatResult.message || 'Action not allowed',
        reason: antiCheatResult.reason
      });
    }

    // If already completed, don't award gamification rewards
    if (antiCheatResult.alreadyCompleted) {
      return res.json({
        success: true,
        message: 'Lesson already completed',
        alreadyCompleted: true
      });
    }

    await connection.beginTransaction();

    // Get lesson and course details
    const [lessonData] = await connection.query(
      `SELECT l.title as lesson_title, l.course_id, l.duration_minutes,
              c.title as course_title, c.difficulty_level, c.points_reward,
              e.id as enrollment_id
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       JOIN enrollments e ON c.id = e.course_id
       WHERE l.id = ? AND e.user_id = ?`,
      [lessonId, user_id]
    );

    if (lessonData.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Lesson not found or not enrolled in course'
      });
    }

    const {
      lesson_title,
      course_id,
      course_title,
      difficulty_level,
      points_reward,
      enrollment_id
    } = lessonData[0];

    // Update lesson progress
    await connection.query(
      `UPDATE lesson_progress
       SET is_completed = true,
           completed_at = CURRENT_TIMESTAMP,
           time_spent_minutes = time_spent_minutes + ?
       WHERE enrollment_id = ? AND lesson_id = ?`,
      [time_spent_minutes, enrollment_id, lessonId]
    );

    // === GAMIFICATION LOGIC ===

    // 1. Update streak on activity
    const streakResult = await updateStreakOnActivity(connection, user_id);

    // 2. Award XP for lesson completion
    const xpResult = await awardLessonXP(
      connection,
      user_id,
      lessonId,
      lesson_title,
      streakResult.isFirstActivityToday
    );

    // 3. Update daily XP in activity log
    await updateDailyXP(connection, user_id, xpResult.totalXP);

    // 4. Prepare badge metadata
    const currentHour = new Date().getHours();
    const badgeMetadata = {
      hour: currentHour,
      lessonCompleted: true,
      courseId: course_id,
      difficulty: difficulty_level
    };

    // 5. Check and award badges
    const newBadges = await checkAndAwardBadges(connection, user_id, badgeMetadata);

    // 6. Award streak milestone bonus XP if applicable
    let streakBonusXP = null;
    if (streakResult.streakMilestone) {
      streakBonusXP = await awardStreakBonusXP(
        connection,
        user_id,
        streakResult.streakMilestone
      );
    }

    // === END GAMIFICATION LOGIC ===

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
    let certificateId = null;
    let courseXPResult = null;

    // If course is fully completed, award points and course XP
    if (isCompleted) {
      // Award traditional points
      if (points_reward > 0) {
        pointsEarned = points_reward;

        // Add points to user
        await connection.query(
          'UPDATE users SET points = points + ? WHERE id = ?',
          [pointsEarned, user_id]
        );

        // Record transaction
        await connection.query(
          'INSERT INTO point_transactions (user_id, amount, type, description, reference_id) VALUES (?, ?, ?, ?, ?)',
          [user_id, pointsEarned, 'earned', `Completed: ${course_title}`, course_id]
        );
      }

      // Award course completion XP
      courseXPResult = await awardCourseXP(
        connection,
        user_id,
        course_id,
        course_title,
        difficulty_level
      );

      // Update daily XP with course completion bonus
      await updateDailyXP(connection, user_id, courseXPResult.xpAwarded);

      // Check for additional badges after course completion
      const courseBadgeMetadata = {
        ...badgeMetadata,
        courseCompleted: true,
        difficulty: difficulty_level
      };
      const courseBadges = await checkAndAwardBadges(connection, user_id, courseBadgeMetadata);
      newBadges.push(...courseBadges);

      // Get updated balance
      const [updatedUser] = await connection.query(
        'SELECT points FROM users WHERE id = ?',
        [user_id]
      );
      pointsBalance = updatedUser[0].points;

      // Auto-generate certificate
      certificateId = await createCertificateRecord(connection, user_id, course_id);
    }

    await connection.commit();

    // === REAL-TIME NOTIFICATIONS ===

    try {
      // Emit XP earned event
      emitToUser(user_id, 'xp_earned', {
        amount: xpResult.totalXP + (courseXPResult?.xpAwarded || 0) + (streakBonusXP?.xpAwarded || 0),
        newXP: xpResult.xp,
        breakdown: {
          lesson: xpResult.results,
          course: courseXPResult ? { type: 'course_complete', xp: courseXPResult.xpAwarded } : null,
          streak: streakBonusXP ? { type: 'streak_bonus', xp: streakBonusXP.xpAwarded } : null
        }
      });

      // Emit level up event if leveled up
      if (xpResult.leveledUp || courseXPResult?.leveledUp) {
        const finalLevel = courseXPResult?.level || xpResult.level;
        const previousLevel = courseXPResult?.previousLevel || xpResult.previousLevel;

        emitToUser(user_id, 'level_up', {
          newLevel: finalLevel,
          previousLevel: previousLevel
        });

        // Create level up notification
        await createNotification(
          user_id,
          'level_up',
          'Level Up!',
          `🎉 Congratulations! You've reached level ${finalLevel}!`,
          null
        );
      }

      // Emit streak update
      if (streakResult.streakExtended) {
        emitToUser(user_id, 'streak_update', {
          current: streakResult.currentStreak,
          isExtended: true,
          milestone: streakResult.streakMilestone,
          freezeUsed: streakResult.freezeUsed
        });

        // Create streak milestone notification
        if (streakResult.streakMilestone) {
          await createNotification(
            user_id,
            'streak_milestone',
            'Streak Milestone!',
            `🔥 Amazing! You've reached a ${streakResult.streakMilestone}-day learning streak!`,
            null
          );
        }
      }

      // Emit badge earned events
      for (const badge of newBadges) {
        emitToUser(user_id, 'badge_earned', badge);

        // Create badge notification
        await createNotification(
          user_id,
          'badge_earned',
          'Badge Earned!',
          `🏆 You've earned the "${badge.name}" badge!`,
          badge.id
        );
      }
    } catch (notificationError) {
      console.error('Failed to send real-time notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    // Build response
    const response = {
      success: true,
      message: isCompleted
        ? `🎉 Course completed! You earned ${pointsEarned} points and ${(courseXPResult?.xpAwarded || 0)} XP!`
        : `Lesson completed! +${xpResult.totalXP} XP`,
      progress_percentage: progressPercentage,
      course_completed: isCompleted,
      gamification: {
        xp: {
          earned: xpResult.totalXP + (courseXPResult?.xpAwarded || 0) + (streakBonusXP?.xpAwarded || 0),
          total: xpResult.xp,
          level: courseXPResult?.level || xpResult.level,
          leveledUp: xpResult.leveledUp || courseXPResult?.leveledUp
        },
        streak: {
          current: streakResult.currentStreak,
          extended: streakResult.streakExtended,
          milestone: streakResult.streakMilestone,
          freezeUsed: streakResult.freezeUsed
        },
        badges: newBadges.map(b => ({
          id: b.id,
          name: b.name,
          tier: b.tier,
          xp_reward: b.xp_reward
        }))
      }
    };

    if (isCompleted) {
      response.points_earned = pointsEarned;
      response.points_balance = pointsBalance;
      response.certificate_id = certificateId;
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