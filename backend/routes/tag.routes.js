const express = require('express');
const router = express.Router();
const {
  getAllTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  getPopularTags,
  getCourseTagsById,
  addTagToCourse,
  removeTagFromCourse,
  updateCourseTags
} = require('../controllers/tag.controller');
const { auth, isInstructor } = require('../middleware/auth.middleware');

// Public routes
router.get('/', getAllTags);
router.get('/popular', getPopularTags);
router.get('/:id', getTagById);
router.get('/course/:courseId', getCourseTagsById);

// Protected routes - Instructor only for tag management
router.post('/', auth, isInstructor, createTag);
router.put('/:id', auth, isInstructor, updateTag);
router.delete('/:id', auth, isInstructor, deleteTag);

// Protected routes - Instructor for course-tag relationships
router.post('/course/:courseId', auth, isInstructor, addTagToCourse);
router.delete('/course/:courseId/:tagId', auth, isInstructor, removeTagFromCourse);
router.put('/course/:courseId', auth, isInstructor, updateCourseTags);

module.exports = router;
