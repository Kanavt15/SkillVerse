/**
 * Category — a CSE knowledge domain (Data Structures, DBMS, ...).
 *
 * The MySQL seed shipped generic skill-sharing categories (Design, Photography,
 * Music, Cooking). The seed script replaces those with the 17 CSE categories
 * from the spec; admins can add more.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 1000 },
    icon: { type: String, default: null, maxlength: 50 },
    // Display order on the explore page.
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// ON DELETE SET NULL in schema.sql:52 — deleting a category must not delete
// the courses filed under it.
categorySchema.plugin(cascadeDelete, {
    children: [
        { model: 'Course', foreignKey: 'category', onDelete: 'unset' },
    ],
});

module.exports = mongoose.model('Category', categorySchema);
