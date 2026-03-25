const { pool } = require('../config/database');
const { cacheGetOrSet, CacheKeys, CacheTTL } = require('../utils/cache.utils');

/**
 * Get instructor dashboard statistics
 * @route GET /api/instructors/stats
 * @access Private (Instructor only)
 */
const getInstructorStats = async (req, res) => {
  try {
    const instructorId = req.user.id;

    const cacheKey = CacheKeys.instructorStats(instructorId);

    const { data, fromCache } = await cacheGetOrSet(
      cacheKey,
      CacheTTL.INSTRUCTOR_STATS,
      async () => fetchInstructorStats(instructorId)
    );

    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');

    res.json({
      success: true,
      stats: data,
      cached: fromCache
    });
  } catch (error) {
    console.error('Get instructor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching instructor statistics'
    });
  }
};

/**
 * Fetch instructor statistics from database
 * @param {number} instructorId
 */
async function fetchInstructorStats(instructorId) {
  // Query 1: Course and enrollment statistics
  const [courseStats] = await pool.query(`
    SELECT
      COUNT(DISTINCT c.id) as total_courses,
      COUNT(DISTINCT CASE WHEN c.is_published = 1 THEN c.id END) as published_courses,
      COUNT(DISTINCT e.id) as total_enrollments,
      COUNT(DISTINCT e.user_id) as total_students
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id
    WHERE c.instructor_id = ?
  `, [instructorId]);

  // Query 2: Review statistics
  const [reviewStats] = await pool.query(`
    SELECT
      COUNT(r.id) as total_reviews,
      COALESCE(AVG(r.rating), 0) as avg_rating,
      COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_star_reviews,
      COUNT(CASE WHEN r.rating >= 4 THEN 1 END) as positive_reviews
    FROM courses c
    LEFT JOIN reviews r ON c.id = r.course_id
    WHERE c.instructor_id = ?
  `, [instructorId]);

  // Query 3: Completion statistics
  const [completionStats] = await pool.query(`
    SELECT
      COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) as total_completions,
      ROUND(
        COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) * 100.0 /
        NULLIF(COUNT(e.id), 0),
        1
      ) as completion_rate
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id
    WHERE c.instructor_id = ?
  `, [instructorId]);

  // Query 4: Revenue calculation (points spent on instructor's courses)
  const [revenueStats] = await pool.query(`
    SELECT
      COALESCE(SUM(ABS(pt.amount)), 0) as total_revenue
    FROM point_transactions pt
    JOIN enrollments e ON pt.user_id = e.user_id
    JOIN courses c ON e.course_id = c.id
    WHERE c.instructor_id = ?
      AND pt.type = 'spent'
      AND pt.reference_id = c.id
      AND pt.reference_type = 'course'
  `, [instructorId]);

  // Query 5: Recent activity (enrollments in last 30 days)
  const [recentActivity] = await pool.query(`
    SELECT
      COUNT(DISTINCT e.id) as recent_enrollments,
      COUNT(DISTINCT r.id) as recent_reviews
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id
      AND e.enrolled_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    LEFT JOIN reviews r ON c.id = r.course_id
      AND r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    WHERE c.instructor_id = ?
  `, [instructorId]);

  return {
    courses: {
      total: courseStats[0].total_courses || 0,
      published: courseStats[0].published_courses || 0,
      draft: (courseStats[0].total_courses || 0) - (courseStats[0].published_courses || 0)
    },
    students: {
      total: courseStats[0].total_students || 0,
      enrollments: courseStats[0].total_enrollments || 0,
      completions: completionStats[0].total_completions || 0,
      completionRate: parseFloat(completionStats[0].completion_rate) || 0
    },
    reviews: {
      total: reviewStats[0].total_reviews || 0,
      avgRating: parseFloat(parseFloat(reviewStats[0].avg_rating || 0).toFixed(2)),
      fiveStarCount: reviewStats[0].five_star_reviews || 0,
      positiveCount: reviewStats[0].positive_reviews || 0
    },
    revenue: {
      totalPointsEarned: revenueStats[0].total_revenue || 0
    },
    recentActivity: {
      enrollmentsLast30Days: recentActivity[0].recent_enrollments || 0,
      reviewsLast30Days: recentActivity[0].recent_reviews || 0
    },
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  getInstructorStats
};
