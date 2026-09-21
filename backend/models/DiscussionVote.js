/**
 * DiscussionVote — one upvote per user per post.
 *
 * Its own collection rather than an array on the post: vote counts on a popular
 * thread are unbounded, and the uniqueness guarantee is what makes toggling
 * safe under concurrent requests.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const discussionVoteSchema = new Schema({
    post: { type: Schema.Types.ObjectId, ref: 'DiscussionPost', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

// Replaces `unique_vote (user_id, post_id)`.
discussionVoteSchema.index({ user: 1, post: 1 }, { unique: true });

module.exports = mongoose.model('DiscussionVote', discussionVoteSchema);
