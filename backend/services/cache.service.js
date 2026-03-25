const { cacheDel, cacheDelPattern, CacheKeys } = require('../utils/cache.utils');

/**
 * Invalidate all course list caches
 * Called when: course created, course updated, course deleted, enrollment created, review changed
 */
async function invalidateCourseLists() {
  console.log('[Cache] Invalidating all course list caches');
  return cacheDelPattern(CacheKeys.patterns.allCourseLists);
}

/**
 * Invalidate a single course's detail cache
 * @param {number} courseId
 */
async function invalidateCourseDetail(courseId) {
  console.log(`[Cache] Invalidating course detail for course ${courseId}`);
  return cacheDel(CacheKeys.courseDetail(courseId));
}

/**
 * Invalidate instructor dashboard stats
 * @param {number} instructorId
 */
async function invalidateInstructorStats(instructorId) {
  console.log(`[Cache] Invalidating instructor stats for user ${instructorId}`);
  return cacheDel(CacheKeys.instructorStats(instructorId));
}

/**
 * Called when a new course is created
 * @param {object} params - { courseId, instructorId, categoryId }
 */
async function onCourseCreated({ courseId, instructorId, categoryId }) {
  await Promise.all([
    invalidateCourseLists(),
    invalidateInstructorStats(instructorId)
  ]);
}

/**
 * Called when a course is updated
 * @param {object} params - { courseId, instructorId, categoryId }
 */
async function onCourseUpdated({ courseId, instructorId, categoryId }) {
  await Promise.all([
    invalidateCourseDetail(courseId),
    invalidateCourseLists(),
    invalidateInstructorStats(instructorId)
  ]);
}

/**
 * Called when a course is deleted
 * @param {object} params - { courseId, instructorId, categoryId }
 */
async function onCourseDeleted({ courseId, instructorId, categoryId }) {
  await Promise.all([
    invalidateCourseDetail(courseId),
    invalidateCourseLists(),
    invalidateInstructorStats(instructorId)
  ]);
}

/**
 * Called when a new enrollment is created
 * @param {object} params - { courseId, instructorId, userId }
 */
async function onEnrollmentCreated({ courseId, instructorId, userId }) {
  await Promise.all([
    // Enrollment count affects "popular" sort and course detail
    invalidateCourseLists(),
    invalidateCourseDetail(courseId),
    // Instructor's total_students count changed
    invalidateInstructorStats(instructorId)
  ]);
}

/**
 * Called when a review is created/updated/deleted
 * @param {object} params - { courseId, instructorId }
 */
async function onReviewChanged({ courseId, instructorId }) {
  await Promise.all([
    // Rating sort and avg_rating affected
    invalidateCourseLists(),
    invalidateCourseDetail(courseId),
    // Instructor's avg_rating and total_reviews changed
    invalidateInstructorStats(instructorId)
  ]);
}

/**
 * Called when a course is completed (enrollment completed)
 * @param {object} params - { courseId, instructorId, userId }
 */
async function onCourseCompleted({ courseId, instructorId, userId }) {
  // This affects instructor completion rate stats
  await invalidateInstructorStats(instructorId);
}

module.exports = {
  // Individual invalidators
  invalidateCourseLists,
  invalidateCourseDetail,
  invalidateInstructorStats,

  // Event handlers
  onCourseCreated,
  onCourseUpdated,
  onCourseDeleted,
  onEnrollmentCreated,
  onReviewChanged,
  onCourseCompleted
};
