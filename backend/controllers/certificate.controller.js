const { pool } = require('../config/database');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { createNotification } = require('./notification.controller');

// Generate a UUID v4
const generateUUID = () => crypto.randomUUID();

// Internal: generate certificate record (called from enrollment controller)
const createCertificateRecord = async (connection, userId, courseId) => {
    // Check if certificate already exists (idempotent)
    const [existing] = await connection.query(
        'SELECT certificate_id FROM certificates WHERE user_id = ? AND course_id = ?',
        [userId, courseId]
    );
    if (existing.length > 0) {
        return existing[0].certificate_id;
    }

    // Get instructor name
    const [courseData] = await connection.query(
        `SELECT c.title, u.full_name as instructor_name
     FROM courses c
     JOIN users u ON c.instructor_id = u.id
     WHERE c.id = ?`,
        [courseId]
    );
    const instructorName = courseData.length > 0 ? courseData[0].instructor_name : 'Unknown';

    const certId = generateUUID();

    await connection.query(
        `INSERT INTO certificates (certificate_id, user_id, course_id, instructor_name)
     VALUES (?, ?, ?, ?)`,
        [certId, userId, courseId, instructorName]
    );

    // Notify learner about the certificate (fire and forget)
    const courseTitle = courseData.length > 0 ? courseData[0].title : 'a course';
    createNotification(
        userId,
        'certificate',
        'Certificate Earned! 🎉',
        `Congratulations! You earned a certificate for completing "${courseTitle}"`,
        courseId
    ).catch(() => { });

    return certId;
};

// GET /api/certificates — user's certificates
const getUserCertificates = async (req, res) => {
    try {
        const userId = req.user.id;

        const [certificates] = await pool.query(
            `SELECT cert.*, c.title as course_title, c.thumbnail, c.difficulty_level,
              u.full_name as user_name
       FROM certificates cert
       JOIN courses c ON cert.course_id = c.id
       JOIN users u ON cert.user_id = u.id
       WHERE cert.user_id = ?
       ORDER BY cert.issued_at DESC`,
            [userId]
        );

        res.json({ success: true, certificates });
    } catch (error) {
        console.error('Get certificates error:', error);
        res.status(500).json({ success: false, message: 'Error fetching certificates' });
    }
};

// GET /api/certificates/course/:courseId — certificate for specific course
const getCertificateForCourse = async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId } = req.params;

        const [certificates] = await pool.query(
            `SELECT cert.*, c.title as course_title, u.full_name as user_name
       FROM certificates cert
       JOIN courses c ON cert.course_id = c.id
       JOIN users u ON cert.user_id = u.id
       WHERE cert.user_id = ? AND cert.course_id = ?`,
            [userId, courseId]
        );

        if (certificates.length === 0) {
            return res.json({ success: true, certificate: null });
        }

        res.json({ success: true, certificate: certificates[0] });
    } catch (error) {
        console.error('Get certificate for course error:', error);
        res.status(500).json({ success: false, message: 'Error fetching certificate' });
    }
};

// GET /api/certificates/:certId/download — download PDF
const downloadCertificatePDF = async (req, res) => {
    try {
        const { certId } = req.params;
        const userId = req.user.id;

        const [certificates] = await pool.query(
            `SELECT cert.*, c.title as course_title, u.full_name as user_name
       FROM certificates cert
       JOIN courses c ON cert.course_id = c.id
       JOIN users u ON cert.user_id = u.id
       WHERE cert.certificate_id = ? AND cert.user_id = ?`,
            [certId, userId]
        );

        if (certificates.length === 0) {
            return res.status(404).json({ success: false, message: 'Certificate not found' });
        }

        const cert = certificates[0];
        const issuedDate = new Date(cert.issued_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // Create PDF — landscape A4
        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margins: { top: 40, bottom: 40, left: 50, right: 50 }
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="SkillVerse-Certificate-${cert.certificate_id}.pdf"`);
        doc.pipe(res);

        const pageW = doc.page.width;
        const pageH = doc.page.height;

        // ---- Decorative border ----
        // Outer border
        doc.lineWidth(3)
            .strokeColor('#0891B2')
            .rect(20, 20, pageW - 40, pageH - 40)
            .stroke();

        // Inner border
        doc.lineWidth(1)
            .strokeColor('#06B6D4')
            .rect(30, 30, pageW - 60, pageH - 60)
            .stroke();

        // Corner accents (small squares)
        const accentSize = 12;
        const corners = [
            [25, 25], [pageW - 25 - accentSize, 25],
            [25, pageH - 25 - accentSize], [pageW - 25 - accentSize, pageH - 25 - accentSize]
        ];
        corners.forEach(([x, y]) => {
            doc.rect(x, y, accentSize, accentSize).fill('#0891B2');
        });

        // ---- Header ----
        let y = 60;

        // SkillVerse branding
        doc.fontSize(14)
            .fillColor('#64748B')
            .font('Helvetica')
            .text('SKILLVERSE', 0, y, { align: 'center' });
        y += 30;

        // Decorative line
        doc.moveTo(pageW / 2 - 100, y).lineTo(pageW / 2 + 100, y).lineWidth(1).strokeColor('#CBD5E1').stroke();
        y += 20;

        // Title
        doc.fontSize(36)
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .text('Certificate of Completion', 0, y, { align: 'center' });
        y += 60;

        // Subtitle
        doc.fontSize(13)
            .fillColor('#64748B')
            .font('Helvetica')
            .text('This is to certify that', 0, y, { align: 'center' });
        y += 28;

        // User name
        doc.fontSize(30)
            .fillColor('#0891B2')
            .font('Helvetica-Bold')
            .text(cert.user_name, 0, y, { align: 'center' });
        y += 50;

        // Completion text
        doc.fontSize(13)
            .fillColor('#64748B')
            .font('Helvetica')
            .text('has successfully completed the course', 0, y, { align: 'center' });
        y += 28;

        // Course title
        doc.fontSize(22)
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .text(`"${cert.course_title}"`, 50, y, { align: 'center', width: pageW - 100 });
        y += 45;

        // Instructor
        doc.fontSize(12)
            .fillColor('#64748B')
            .font('Helvetica')
            .text(`Instructed by ${cert.instructor_name}`, 0, y, { align: 'center' });
        y += 20;

        // Date
        doc.fontSize(12)
            .fillColor('#64748B')
            .text(`Issued on ${issuedDate}`, 0, y, { align: 'center' });
        y += 40;

        // Decorative line
        doc.moveTo(pageW / 2 - 150, y).lineTo(pageW / 2 + 150, y).lineWidth(1).strokeColor('#CBD5E1').stroke();
        y += 20;

        // Certificate ID & verification URL
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        doc.fontSize(9)
            .fillColor('#94A3B8')
            .font('Helvetica')
            .text(`Certificate ID: ${cert.certificate_id}`, 0, y, { align: 'center' });
        y += 14;
        doc.text(`Verify at: ${clientUrl}/verify/${cert.certificate_id}`, 0, y, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Download certificate error:', error);
        res.status(500).json({ success: false, message: 'Error generating certificate PDF' });
    }
};

// GET /api/certificates/verify/:certId — public verification
const verifyCertificate = async (req, res) => {
    try {
        const { certId } = req.params;

        const [certificates] = await pool.query(
            `SELECT cert.certificate_id, cert.issued_at, cert.instructor_name,
              c.title as course_title,
              u.full_name as user_name
       FROM certificates cert
       JOIN courses c ON cert.course_id = c.id
       JOIN users u ON cert.user_id = u.id
       WHERE cert.certificate_id = ?`,
            [certId]
        );

        if (certificates.length === 0) {
            return res.json({
                success: true,
                valid: false,
                message: 'Certificate not found'
            });
        }

        const cert = certificates[0];
        res.json({
            success: true,
            valid: true,
            certificate: {
                certificate_id: cert.certificate_id,
                user_name: cert.user_name,
                course_title: cert.course_title,
                instructor_name: cert.instructor_name,
                issued_at: cert.issued_at
            }
        });
    } catch (error) {
        console.error('Verify certificate error:', error);
        res.status(500).json({ success: false, message: 'Error verifying certificate' });
    }
};

module.exports = {
    createCertificateRecord,
    getUserCertificates,
    getCertificateForCourse,
    downloadCertificatePDF,
    verifyCertificate
};
