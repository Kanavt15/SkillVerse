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
const { validate, objectIdParam } = require('../middleware/validate.middleware');
const mongoose = require('mongoose');

const router = express.Router();

// Ids are ObjectIds now, so every isInt() id check below became an
// ObjectId check. Leaving them as isInt() would have rejected every request.
const objectIdBody = (name) => body(name)
  .custom((v) => mongoose.isValidObjectId(v))
  .withMessage(`Valid ${name} is required`);

// @route   POST /api/enrollments
// @desc    Enroll in a course
// @access  Private (Learner)
router.post('/',
  auth, isLearner,
  [objectIdBody('course_id')],
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
  [objectIdParam('courseId')],
  validate,
  getCourseProgress
);

// @route   PUT /api/enrollments/lesson/:lessonId/complete
// @desc    Mark lesson as complete
// @access  Private (Learner)
router.put('/lesson/:lessonId/complete',
  auth, isLearner,
  [
    objectIdParam('lessonId'),
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
    objectIdParam('lessonId'),
    body('time_spent_minutes').optional().isInt({ min: 0, max: 1440 }).withMessage('Time spent must be between 0 and 1440 minutes')
  ],
  validate,
  updateLessonProgress
);

module.exports = router;
