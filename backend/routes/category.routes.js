const express = require('express');
const { getAllCategories } = require('../controllers/category.controller');

const router = express.Router();

// @route   GET /api/categories
// @desc    Get all categories
// @access  Public
router.get('/', getAllCategories);

module.exports = router;
