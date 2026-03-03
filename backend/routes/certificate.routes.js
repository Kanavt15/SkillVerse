const express = require('express');
const {
    getUserCertificates,
    getCertificateForCourse,
    downloadCertificatePDF,
    verifyCertificate
} = require('../controllers/certificate.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// @route   GET /api/certificates/verify/:certId
// @desc    Public certificate verification
// @access  Public
router.get('/verify/:certId', verifyCertificate);

// @route   GET /api/certificates
// @desc    Get authenticated user's certificates
// @access  Private
router.get('/', auth, getUserCertificates);

// @route   GET /api/certificates/course/:courseId
// @desc    Get certificate for a specific course
// @access  Private
router.get('/course/:courseId', auth, getCertificateForCourse);

// @route   GET /api/certificates/:certId/download
// @desc    Download certificate PDF
// @access  Private
router.get('/:certId/download', auth, downloadCertificatePDF);

module.exports = router;
