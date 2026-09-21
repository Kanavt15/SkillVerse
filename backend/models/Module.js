/**
 * Module — the Course > Module > Lesson tier the spec calls for (§10).
 *
 * MySQL had no equivalent; lessons hung directly off courses. Existing courses
 * get one default module during seeding so nothing has to special-case a
 * missing tier.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

const { Schema } = mongoose;

const moduleSchema = new Schema({
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 255 },
    description: { type: String, default: '', maxlength: 2000 },
    order: { type: Number, required: true, min: 0 },
}, { timestamps: true });

moduleSchema.index({ course: 1, order: 1 });

moduleSchema.plugin(cascadeDelete, {
    children: [
        // Deleting a module removes its lessons, matching how deleting a course
        // removed them under MySQL's FK chain.
        { model: 'Lesson', foreignKey: 'module' },
    ],
});

module.exports = mongoose.model('Module', moduleSchema);
