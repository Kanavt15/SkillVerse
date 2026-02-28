const express = require('express');
const { body } = require('express-validator');
const {
  createCourse,
  getAllCourses,
  getCourseById,
  getInstructorCourses,
  updateCourse,
  deleteCourse
} = require('../controllers/course.controller');
const { createLesson } = require('../controllers/lesson.controller');
const { auth, isInstructor } = require('../middleware/auth.middleware');
const { uploadThumbnail, uploadVideo, validateUploadedImage, validateUploadedVideo } = require('../middleware/upload.middleware');

const router = express.Router();

// Validation rules
const courseValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title must be 200 characters or less'),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }).withMessage('Description must be 5000 characters or less'),
  body('difficulty_level').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('points_cost').optional().isInt({ min: 0, max: 10000 }).withMessage('Points cost must be between 0 and 10000'),
  body('points_reward').optional().isInt({ min: 0, max: 10000 }).withMessage('Points reward must be between 0 and 10000')
];

// @route   GET /api/courses
// @desc    Get all published courses
// @access  Public
router.get('/', getAllCourses);

// @route   GET /api/courses/instructor
// @desc    Get instructor's courses
// @access  Private (Instructor)
router.get('/instructor', auth, isInstructor, getInstructorCourses);

// @route   GET /api/courses/:id
// @desc    Get single course by ID
// @access  Public
router.get('/:id', getCourseById);

// @route   POST /api/courses
// @desc    Create new course
// @access  Private (Instructor)
router.post('/', auth, isInstructor, uploadThumbnail.single('thumbnail'), validateUploadedImage, courseValidation, createCourse);

// @route   PUT /api/courses/:id
// @desc    Update course
// @access  Private (Instructor - owner only)
router.put('/:id', auth, isInstructor, uploadThumbnail.single('thumbnail'), validateUploadedImage, updateCourse);

// @route   DELETE /api/courses/:id
// @desc    Delete course
// @access  Private (Instructor - owner only)
router.delete('/:id', auth, isInstructor, deleteCourse);

// Nested route for lessons
// @route   POST /api/courses/:id/lessons
// @desc    Create lesson for a course
// @access  Private (Instructor)
router.post(
  '/:id/lessons',
  auth,
  isInstructor,
  uploadVideo.single('video'),
  validateUploadedVideo,
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title must be 200 characters or less'),
    body('lesson_order').isInt({ min: 1 }).withMessage('Valid lesson order is required')
  ],
  createLesson
);

module.exports = router;
