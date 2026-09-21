/**
 * Certificates.
 *
 * The certificate snapshots the learner name, course title and instructor name
 * at issue time rather than joining them on every read. A certificate is a
 * historical record: it must keep showing who actually taught the course even
 * if the course is renamed, changes hands, or the account is deleted.
 *
 * `certificateId` stays a UUID — it is already embedded in public
 * /verify/:certId links, and exposing raw ObjectIds there would leak insertion
 * ordering.
 */

const PDFDocument = require('pdfkit');

const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const User = require('../models/User');
const { createNotification } = require('./notification.controller');

/**
 * Create the certificate for a completed course. Idempotent — completing a
 * course twice must not mint two certificates, which the unique
 * (user, course) index also enforces.
 *
 * Called from inside the lesson-completion transaction, so it takes a session.
 *
 * @returns {Promise<{certificateId: string}|null>}
 */
const createCertificateRecord = async (userId, courseId, session = null) => {
    const existing = await Certificate.findOne({ user: userId, course: courseId })
        .select('certificateId')
        .session(session);

    if (existing) return { certificateId: existing.certificateId };

    const [course, learner] = await Promise.all([
        Course.findById(courseId).select('title instructor').populate('instructor', 'fullName').session(session),
        User.findById(userId).select('fullName').session(session),
    ]);

    if (!course || !learner) return null;

    let certificate;
    try {
        [certificate] = await Certificate.create([{
            user: userId,
            course: courseId,
            instructorName: course.instructor?.fullName || 'Unknown',
            courseTitle: course.title,
            learnerName: learner.fullName,
        }], { session });
    } catch (err) {
        // Lost a race against a concurrent completion; theirs is just as good.
        if (err.code === 11000) {
            const found = await Certificate.findOne({ user: userId, course: courseId })
                .select('certificateId')
                .session(session);
            return found ? { certificateId: found.certificateId } : null;
        }
        throw err;
    }

    await User.updateOne(
        { _id: userId },
        { $inc: { 'learningStats.certificatesEarned': 1 } },
        { session }
    );

    // Fire and forget — outside the transaction's success criteria.
    createNotification(
        userId,
        'certificate',
        'Certificate Earned! 🎉',
        `Congratulations! You earned a certificate for completing "${course.title}"`,
        courseId,
        'course'
    ).catch(() => {});

    return { certificateId: certificate.certificateId };
};

/** Shape a certificate for the API. */
const toLegacy = (c, course = null) => ({
    id: String(c._id),
    certificate_id: c.certificateId,
    certificateId: c.certificateId,
    user_id: String(c.user),
    course_id: String(c.course?._id || c.course),
    course_title: c.courseTitle,
    user_name: c.learnerName,
    instructor_name: c.instructorName,
    issued_at: c.issuedAt,
    thumbnail: course?.thumbnail ?? (c.course?.thumbnail || null),
    difficulty_level: course?.difficulty ?? (c.course?.difficulty || null),
});

// ------------------------------------------------------------------
// GET /api/certificates
// ------------------------------------------------------------------
const getUserCertificates = async (req, res, next) => {
    try {
        const certificates = await Certificate.find({ user: req.user.id })
            .sort({ issuedAt: -1 })
            .populate('course', 'title thumbnail difficulty')
            .lean();

        return res.json({
            success: true,
            count: certificates.length,
            certificates: certificates.map((c) => toLegacy(c)),
        });
    } catch (error) {
        console.error('Get certificates error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/certificates/course/:courseId
// ------------------------------------------------------------------
const getCertificateForCourse = async (req, res, next) => {
    try {
        const certificate = await Certificate.findOne({
            user: req.user.id,
            course: req.params.courseId,
        }).populate('course', 'title thumbnail difficulty').lean();

        if (!certificate) {
            return res.status(404).json({ success: false, message: 'Certificate not found' });
        }

        return res.json({ success: true, certificate: toLegacy(certificate) });
    } catch (error) {
        console.error('Get certificate error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/certificates/:certId/download
// ------------------------------------------------------------------
const downloadCertificatePDF = async (req, res, next) => {
    try {
        // Scoped to the requesting user: a certificate id is guessable enough
        // that anyone holding one should not be able to download someone
        // else's PDF.
        const cert = await Certificate.findOne({
            certificateId: req.params.certId,
            user: req.user.id,
        }).lean();

        if (!cert) {
            return res.status(404).json({ success: false, message: 'Certificate not found' });
        }

        const issuedDate = new Date(cert.issuedAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });

        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margins: { top: 40, bottom: 40, left: 50, right: 50 },
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="SkillVerse-Certificate-${cert.certificateId}.pdf"`
        );
        doc.pipe(res);

        const pageW = doc.page.width;
        const pageH = doc.page.height;

        // ---- Decorative border ----
        doc.lineWidth(3).strokeColor('#0891B2').rect(20, 20, pageW - 40, pageH - 40).stroke();
        doc.lineWidth(1).strokeColor('#06B6D4').rect(30, 30, pageW - 60, pageH - 60).stroke();

        const accentSize = 12;
        [
            [25, 25], [pageW - 25 - accentSize, 25],
            [25, pageH - 25 - accentSize], [pageW - 25 - accentSize, pageH - 25 - accentSize],
        ].forEach(([x, y]) => doc.rect(x, y, accentSize, accentSize).fill('#0891B2'));

        // ---- Content ----
        let y = 60;

        doc.fontSize(14).fillColor('#64748B').font('Helvetica')
            .text('SKILLVERSE', 0, y, { align: 'center' });
        y += 30;

        doc.moveTo(pageW / 2 - 100, y).lineTo(pageW / 2 + 100, y)
            .lineWidth(1).strokeColor('#CBD5E1').stroke();
        y += 20;

        doc.fontSize(36).fillColor('#0F172A').font('Helvetica-Bold')
            .text('Certificate of Completion', 0, y, { align: 'center' });
        y += 60;

        doc.fontSize(13).fillColor('#64748B').font('Helvetica')
            .text('This is to certify that', 0, y, { align: 'center' });
        y += 28;

        doc.fontSize(30).fillColor('#0891B2').font('Helvetica-Bold')
            .text(cert.learnerName, 0, y, { align: 'center' });
        y += 50;

        doc.fontSize(13).fillColor('#64748B').font('Helvetica')
            .text('has successfully completed the course', 0, y, { align: 'center' });
        y += 28;

        doc.fontSize(22).fillColor('#0F172A').font('Helvetica-Bold')
            .text(`"${cert.courseTitle}"`, 50, y, { align: 'center', width: pageW - 100 });
        y += 45;

        doc.fontSize(12).fillColor('#64748B').font('Helvetica')
            .text(`Instructed by ${cert.instructorName}`, 0, y, { align: 'center' });
        y += 20;

        doc.fontSize(12).fillColor('#64748B')
            .text(`Issued on ${issuedDate}`, 0, y, { align: 'center' });
        y += 40;

        doc.moveTo(pageW / 2 - 150, y).lineTo(pageW / 2 + 150, y)
            .lineWidth(1).strokeColor('#CBD5E1').stroke();
        y += 20;

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        doc.fontSize(9).fillColor('#94A3B8').font('Helvetica')
            .text(`Certificate ID: ${cert.certificateId}`, 0, y, { align: 'center' });
        y += 14;
        doc.text(`Verify at: ${clientUrl}/verify/${cert.certificateId}`, 0, y, { align: 'center' });

        return doc.end();
    } catch (error) {
        console.error('Download certificate error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/certificates/verify/:certId  (public)
// ------------------------------------------------------------------
const verifyCertificate = async (req, res, next) => {
    try {
        const cert = await Certificate.findOne({ certificateId: req.params.certId }).lean();

        if (!cert) {
            // 200 with valid:false — "not a real certificate" is a successful
            // answer to a verification question, not an error.
            return res.json({ success: true, valid: false, message: 'Certificate not found' });
        }

        return res.json({
            success: true,
            valid: true,
            certificate: {
                certificate_id: cert.certificateId,
                // Only what a verifier needs. No ids, no email, no wallet.
                user_name: cert.learnerName,
                course_title: cert.courseTitle,
                instructor_name: cert.instructorName,
                issued_at: cert.issuedAt,
            },
        });
    } catch (error) {
        console.error('Verify certificate error:', error);
        return next(error);
    }
};

module.exports = {
    createCertificateRecord,
    getUserCertificates,
    getCertificateForCourse,
    downloadCertificatePDF,
    verifyCertificate,
};
