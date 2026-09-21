/**
 * Certificate — issued once on course completion, publicly verifiable.
 *
 * `certificateId` stays a UUID string rather than becoming the ObjectId: it is
 * already baked into public /verify/:certId URLs, and exposing raw ObjectIds in
 * a public verification link would leak insertion ordering.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const { Schema } = mongoose;

const certificateSchema = new Schema({
    certificateId: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto.randomUUID(),
    },

    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    // Snapshotted at issue time. A certificate must keep showing the instructor
    // who actually taught the course, even if the course changes hands or the
    // account is deleted.
    instructorName: { type: String, required: true, maxlength: 255 },
    courseTitle: { type: String, required: true, maxlength: 255 },
    learnerName: { type: String, required: true, maxlength: 255 },

    issuedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Replaces `unique_user_course_cert`. createCertificateRecord relies on this
// for idempotency — completing a course twice must not mint two certificates.
certificateSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Certificate', certificateSchema);
