/**
 * Tag — free-form course labels, separate from Category.
 *
 * MySQL modelled this as course_tags + a course_tag_relations join table. In
 * MongoDB the relation collapses into a `tags` array on Course, so the join
 * table disappears; `usageCount` is denormalized here to keep the "popular
 * tags" query from scanning every course.
 */

const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    usageCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

tagSchema.index({ usageCount: -1 });
// Replaces `LIKE '%term%'` in tag.controller.js:21 — still a prefix scan, but
// an indexed one.
tagSchema.index({ name: 'text' });

module.exports = mongoose.model('Tag', tagSchema);
