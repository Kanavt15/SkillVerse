const express = require('express');
const { body, param } = require('express-validator');
const {
  enrollCourse,
  getEnrolledCourses,
  getCourseProgress,
  markLessonComplete,
  updateLessonProgress
} = require('../controllers/enrollment.controller');
const { auth, isLearner } = require('../middleware/auth.middleware');
const { validationResult } = require('express-validator');

const router = express.Router();

// Validation error handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// @route   POST /api/enrollments
// @desc    Enroll in a course
// @access  Private (Learner)
router.post('/',
  auth, isLearner,
  [body('course_id').isInt({ min: 1 }).withMessage('Valid course ID is required')],
  validate,
  enrollCourse
);

// @route   GET /api/enrollments
// @desc    Get user's enrolled courses
// @access  Private (Learner)
router.get('/', auth, isLearner, getEnrolledCourses);

// @route   GET /api/enrollments/course/:courseId
// @desc    Get progress for a specific course
// @access  Private (Learner)
router.get('/course/:courseId',
  auth, isLearner,
  [param('courseId').isInt({ min: 1 }).withMessage('Valid course ID is required')],
  validate,
  getCourseProgress
);

// @route   PUT /api/enrollments/lesson/:lessonId/complete
// @desc    Mark lesson as complete
// @access  Private (Learner)
router.put('/lesson/:lessonId/complete',
  auth, isLearner,
  [
    param('lessonId').isInt({ min: 1 }).withMessage('Valid lesson ID is required'),
    body('time_spent_minutes').optional().isInt({ min: 0, max: 1440 }).withMessage('Time spent must be between 0 and 1440 minutes')
  ],
  validate,
  markLessonComplete
);

// @route   PUT /api/enrollments/lesson/:lessonId/progress
// @desc    Update lesson progress (time spent)
// @access  Private (Learner)
router.put('/lesson/:lessonId/progress',
  auth, isLearner,
  [
    param('lessonId').isInt({ min: 1 }).withMessage('Valid lesson ID is required'),
    body('time_spent_minutes').optional().isInt({ min: 0, max: 1440 }).withMessage('Time spent must be between 0 and 1440 minutes')
  ],
  validate,
  updateLessonProgress
);

module.exports = router;
