const { pool } = require('../config/database');

// Get all categories
const getAllCategories = async (req, res) => {
  try {
    const [categories] = await pool.query(
      `SELECT c.*, COUNT(co.id) as course_count
       FROM categories c
       LEFT JOIN courses co ON c.id = co.category_id AND co.is_published = true
       GROUP BY c.id
       ORDER BY c.name`
    );

    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
};

module.exports = {
  getAllCategories
};
