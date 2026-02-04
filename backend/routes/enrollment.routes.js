const express = require('express');
const {
  enrollCourse,
  getEnrolledCourses,
  getCourseProgress,
  markLessonComplete,
  updateLessonProgress
} = require('../controllers/enrollment.controller');
const { auth, isLearner } = require('../middleware/auth.middleware');

const router = express.Router();

// @route   POST /api/enrollments
// @desc    Enroll in a course
// @access  Private (Learner)
router.post('/', auth, isLearner, enrollCourse);

// @route   GET /api/enrollments
// @desc    Get user's enrolled courses
// @access  Private (Learner)
router.get('/', auth, isLearner, getEnrolledCourses);

// @route   GET /api/enrollments/course/:courseId
// @desc    Get progress for a specific course
// @access  Private (Learner)
router.get('/course/:courseId', auth, isLearner, getCourseProgress);

// @route   PUT /api/enrollments/lesson/:lessonId/complete
// @desc    Mark lesson as complete
// @access  Private (Learner)
router.put('/lesson/:lessonId/complete', auth, isLearner, markLessonComplete);

// @route   PUT /api/enrollments/lesson/:lessonId/progress
// @desc    Update lesson progress (time spent)
// @access  Private (Learner)
router.put('/lesson/:lessonId/progress', auth, isLearner, updateLessonProgress);

module.exports = router;
