const { pool } = require('../config/database');

// Get all tags with optional filters
const getAllTags = async (req, res) => {
  try {
    const { search, sort = 'name', limit = 100 } = req.query;
    
    let query = `
      SELECT 
        ct.*,
        COUNT(ctr.course_id) as course_count
      FROM course_tags ct
      LEFT JOIN course_tag_relations ctr ON ct.id = ctr.tag_id
      LEFT JOIN courses c ON ctr.course_id = c.id AND c.is_published = true
    `;
    
    const params = [];
    
    // Search filter
    if (search) {
      query += ` WHERE ct.name LIKE ? OR ct.description LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` GROUP BY ct.id`;
    
    // Sorting
    const validSorts = {
      name: 'ct.name ASC',
      popular: 'course_count DESC, ct.name ASC',
      newest: 'ct.created_at DESC'
    };
    
    query += ` ORDER BY ${validSorts[sort] || validSorts.name}`;
    
    // Limit
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 100), 500);
    query += ` LIMIT ?`;
    params.push(parsedLimit);
    
    const [tags] = await pool.query(query, params);

    res.json({
      success: true,
      count: tags.length,
      tags
    });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tags'
    });
  }
};

// Get single tag by ID or slug
const getTagById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if id is numeric (ID) or string (slug)
    const isNumeric = /^\d+$/.test(id);
    const field = isNumeric ? 'id' : 'slug';
    
    const [tags] = await pool.query(
      `SELECT 
        ct.*,
        COUNT(ctr.course_id) as course_count
      FROM course_tags ct
      LEFT JOIN course_tag_relations ctr ON ct.id = ctr.tag_id
      LEFT JOIN courses c ON ctr.course_id = c.id AND c.is_published = true
      WHERE ct.${field} = ?
      GROUP BY ct.id`,
      [id]
    );

    if (tags.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }

    res.json({
      success: true,
      tag: tags[0]
    });
  } catch (error) {
    console.error('Get tag error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tag'
    });
  }
};

// Create new tag (admin only)
const createTag = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tag name is required'
      });
    }

    // Generate slug from name
    const slug = name.toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    // Check if tag already exists
    const [existing] = await pool.query(
      'SELECT id FROM course_tags WHERE name = ? OR slug = ?',
      [name.trim(), slug]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Tag with this name already exists'
      });
    }

    // Insert new tag
    const [result] = await pool.query(
      'INSERT INTO course_tags (name, slug, description) VALUES (?, ?, ?)',
      [name.trim(), slug, description?.trim() || null]
    );

    // Fetch created tag
    const [newTag] = await pool.query(
      'SELECT * FROM course_tags WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Tag created successfully',
      tag: newTag[0]
    });
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating tag'
    });
  }
};

// Update tag (admin only)
const updateTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check if tag exists
    const [existing] = await pool.query(
      'SELECT * FROM course_tags WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }

    const updates = [];
    const params = [];

    if (name && name.trim().length > 0) {
      // Generate new slug
      const slug = name.toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      
      updates.push('name = ?', 'slug = ?');
      params.push(name.trim(), slug);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description?.trim() || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    params.push(id);

    await pool.query(
      `UPDATE course_tags SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch updated tag
    const [updatedTag] = await pool.query(
      'SELECT * FROM course_tags WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Tag updated successfully',
      tag: updatedTag[0]
    });
  } catch (error) {
    console.error('Update tag error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating tag'
    });
  }
};

// Delete tag (admin only)
const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if tag exists
    const [existing] = await pool.query(
      'SELECT * FROM course_tags WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }

    // Check if tag is in use
    const [usage] = await pool.query(
      'SELECT COUNT(*) as count FROM course_tag_relations WHERE tag_id = ?',
      [id]
    );

    if (usage[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete tag. It is currently used by ${usage[0].count} course(s)`
      });
    }

    // Delete tag
    await pool.query('DELETE FROM course_tags WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting tag'
    });
  }
};

// Get popular tags
const getPopularTags = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    
    const [tags] = await pool.query(
      `SELECT 
        ct.*,
        COUNT(ctr.course_id) as course_count
      FROM course_tags ct
      INNER JOIN course_tag_relations ctr ON ct.id = ctr.tag_id
      INNER JOIN courses c ON ctr.course_id = c.id AND c.is_published = true
      GROUP BY ct.id
      HAVING course_count > 0
      ORDER BY course_count DESC, ct.name ASC
      LIMIT ?`,
      [parsedLimit]
    );

    res.json({
      success: true,
      count: tags.length,
      tags
    });
  } catch (error) {
    console.error('Get popular tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular tags'
    });
  }
};

// Get tags for a specific course
const getCourseTagsById = async (req, res) => {
  try {
    const { courseId } = req.params;

    const [tags] = await pool.query(
      `SELECT ct.*
      FROM course_tags ct
      INNER JOIN course_tag_relations ctr ON ct.id = ctr.tag_id
      WHERE ctr.course_id = ?
      ORDER BY ct.name`,
      [courseId]
    );

    res.json({
      success: true,
      count: tags.length,
      tags
    });
  } catch (error) {
    console.error('Get course tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching course tags'
    });
  }
};

// Add tag to course (instructor/admin)
const addTagToCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { tag_id } = req.body;

    // Validation
    if (!tag_id) {
      return res.status(400).json({
        success: false,
        message: 'Tag ID is required'
      });
    }

    // Verify course exists
    const [course] = await pool.query(
      'SELECT id FROM courses WHERE id = ?',
      [courseId]
    );

    if (course.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Verify tag exists
    const [tag] = await pool.query(
      'SELECT id FROM course_tags WHERE id = ?',
      [tag_id]
    );

    if (tag.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }

    // Add relationship (ignore if already exists)
    await pool.query(
      'INSERT IGNORE INTO course_tag_relations (course_id, tag_id) VALUES (?, ?)',
      [courseId, tag_id]
    );

    // Update tag usage count
    await pool.query(
      `UPDATE course_tags 
       SET usage_count = (
         SELECT COUNT(*) FROM course_tag_relations WHERE tag_id = ?
       )
       WHERE id = ?`,
      [tag_id, tag_id]
    );

    res.json({
      success: true,
      message: 'Tag added to course successfully'
    });
  } catch (error) {
    console.error('Add tag to course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding tag to course'
    });
  }
};

// Remove tag from course (instructor/admin)
const removeTagFromCourse = async (req, res) => {
  try {
    const { courseId, tagId } = req.params;

    // Delete relationship
    const [result] = await pool.query(
      'DELETE FROM course_tag_relations WHERE course_id = ? AND tag_id = ?',
      [courseId, tagId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tag relationship not found'
      });
    }

    // Update tag usage count
    await pool.query(
      `UPDATE course_tags 
       SET usage_count = (
         SELECT COUNT(*) FROM course_tag_relations WHERE tag_id = ?
       )
       WHERE id = ?`,
      [tagId, tagId]
    );

    res.json({
      success: true,
      message: 'Tag removed from course successfully'
    });
  } catch (error) {
    console.error('Remove tag from course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing tag from course'
    });
  }
};

// Update all tags for a course (instructor/admin)
const updateCourseTags = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { tag_ids } = req.body;

    // Validation
    if (!Array.isArray(tag_ids)) {
      return res.status(400).json({
        success: false,
        message: 'tag_ids must be an array'
      });
    }

    // Verify course exists
    const [course] = await pool.query(
      'SELECT id FROM courses WHERE id = ?',
      [courseId]
    );

    if (course.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get current tags
      const [currentTags] = await connection.query(
        'SELECT tag_id FROM course_tag_relations WHERE course_id = ?',
        [courseId]
      );
      const currentTagIds = currentTags.map(t => t.tag_id);

      // Remove old tags
      await connection.query(
        'DELETE FROM course_tag_relations WHERE course_id = ?',
        [courseId]
      );

      // Add new tags
      if (tag_ids.length > 0) {
        const values = tag_ids.map(tagId => [courseId, tagId]);
        await connection.query(
          'INSERT IGNORE INTO course_tag_relations (course_id, tag_id) VALUES ?',
          [values]
        );
      }

      // Update usage counts for affected tags
      const affectedTags = [...new Set([...currentTagIds, ...tag_ids])];
      
      for (const tagId of affectedTags) {
        await connection.query(
          `UPDATE course_tags 
           SET usage_count = (
             SELECT COUNT(*) FROM course_tag_relations WHERE tag_id = ?
           )
           WHERE id = ?`,
          [tagId, tagId]
        );
      }

      await connection.commit();

      // Fetch updated tags
      const [updatedTags] = await pool.query(
        `SELECT ct.*
        FROM course_tags ct
        INNER JOIN course_tag_relations ctr ON ct.id = ctr.tag_id
        WHERE ctr.course_id = ?
        ORDER BY ct.name`,
        [courseId]
      );

      res.json({
        success: true,
        message: 'Course tags updated successfully',
        count: updatedTags.length,
        tags: updatedTags
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update course tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating course tags'
    });
  }
};

module.exports = {
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
};
