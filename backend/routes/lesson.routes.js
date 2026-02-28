const express = require('express');
const { body } = require('express-validator');
const {
  createLesson,
  getCourseLessons,
  getLessonById,
  updateLesson,
  deleteLesson
} = require('../controllers/lesson.controller');
const { auth, isInstructor } = require('../middleware/auth.middleware');
const { uploadVideo, validateUploadedVideo } = require('../middleware/upload.middleware');

const router = express.Router();

// Validation rules
const lessonValidation = [
  body('course_id').isInt().withMessage('Valid course ID is required'),
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title must be 200 characters or less'),
  body('lesson_order').isInt({ min: 1 }).withMessage('Valid lesson order is required'),
  body('duration_minutes').optional().isInt({ min: 0, max: 1440 }).withMessage('Duration must be between 0 and 1440 minutes'),
  body('content').optional().isLength({ max: 50000 }).withMessage('Content too long')
];

// @route   GET /api/lessons/course/:courseId
// @desc    Get all lessons for a course
// @access  Public
router.get('/course/:courseId', getCourseLessons);

// @route   GET /api/lessons/:id
// @desc    Get single lesson by ID
// @access  Public
router.get('/:id', getLessonById);

// @route   POST /api/lessons
// @desc    Create new lesson
// @access  Private (Instructor)
router.post('/', auth, isInstructor, uploadVideo.single('video'), validateUploadedVideo, lessonValidation, createLesson);

// @route   PUT /api/lessons/:id
// @desc    Update lesson
// @access  Private (Instructor - owner only)
router.put('/:id', auth, isInstructor, uploadVideo.single('video'), validateUploadedVideo, updateLesson);

// @route   DELETE /api/lessons/:id
// @desc    Delete lesson
// @access  Private (Instructor - owner only)
router.delete('/:id', auth, isInstructor, deleteLesson);

module.exports = router;
