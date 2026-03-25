const express = require('express');
const { getInstructorStats } = require('../controllers/instructor.controller');
const { auth, isInstructor } = require('../middleware/auth.middleware');

const router = express.Router();

// @route   GET /api/instructors/stats
// @desc    Get instructor dashboard statistics
// @access  Private (Instructor only)
router.get('/stats', auth, isInstructor, getInstructorStats);

module.exports = router;
