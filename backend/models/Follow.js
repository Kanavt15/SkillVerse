/**
 * Follow — learner follows an instructor.
 *
 * Named `Follow` rather than `Follower` because the document is the
 * relationship, not the person.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const followSchema = new Schema({
    follower: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    following: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

// Replaces `unique_follow (follower_id, following_id)`.
followSchema.index({ follower: 1, following: 1 }, { unique: true });

module.exports = mongoose.model('Follow', followSchema);
