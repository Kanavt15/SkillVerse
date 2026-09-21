/**
 * DiscussionPost — threaded Q&A. `parent === null` is a question, otherwise a reply.
 *
 * SELF-REFERENTIAL CASCADE: schema.sql:179 had
 * `FOREIGN KEY (parent_id) REFERENCES discussion_posts(id) ON DELETE CASCADE`,
 * and deletePost relied on it entirely (the controller comment says so
 * outright). Deleting a question therefore had to remove its whole reply
 * subtree. The cascade plugin recurses through the model's own child list, so
 * declaring DiscussionPost as its own child reproduces that, at any depth.
 */

const mongoose = require('mongoose');
const { cascadeDelete } = require('./plugins/cascade');

const { Schema } = mongoose;

const discussionPostSchema = new Schema({
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', default: null, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parent: { type: Schema.Types.ObjectId, ref: 'DiscussionPost', default: null, index: true },

    content: { type: String, required: true, maxlength: 10000 },

    // Set when the post's author is the course instructor, so the UI can badge
    // it without re-resolving the course on render.
    isInstructorReply: { type: Boolean, default: false },

    // Denormalized counter; the authoritative rows live in DiscussionVote.
    upvoteCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

discussionPostSchema.index({ course: 1, createdAt: -1 });
discussionPostSchema.index({ lesson: 1, createdAt: -1 });
discussionPostSchema.index({ parent: 1, createdAt: 1 });

discussionPostSchema.plugin(cascadeDelete, {
    children: [
        // Recursive: replies, replies-to-replies, and so on.
        { model: 'DiscussionPost', foreignKey: 'parent' },
        { model: 'DiscussionVote', foreignKey: 'post' },
    ],
});

module.exports = mongoose.model('DiscussionPost', discussionPostSchema);
