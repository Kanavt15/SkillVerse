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
const { uploadThumbnail, uploadVideo } = require('../middleware/upload.middleware');

const router = express.Router();

// Validation rules
const courseValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('difficulty_level').optional().isIn(['beginner', 'intermediate', 'advanced'])
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
router.post('/', auth, isInstructor, uploadThumbnail.single('thumbnail'), courseValidation, createCourse);

// @route   PUT /api/courses/:id
// @desc    Update course
// @access  Private (Instructor - owner only)
router.put('/:id', auth, isInstructor, uploadThumbnail.single('thumbnail'), updateCourse);

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
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('lesson_order').isInt({ min: 1 }).withMessage('Valid lesson order is required')
  ],
  createLesson
);

module.exports = router;
