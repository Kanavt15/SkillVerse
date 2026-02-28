const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadsBase = path.join(__dirname, '..', 'uploads');
const uploadDirs = [path.join(uploadsBase, 'thumbnails'), path.join(uploadsBase, 'videos')];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================================
// Magic byte signatures for file type validation
// ============================================================
const MAGIC_BYTES = {
  // Images
  'ffd8ff': 'image/jpeg',       // JPEG
  '89504e47': 'image/png',      // PNG
  '47494638': 'image/gif',      // GIF
  '52494646': 'image/webp',     // WebP (RIFF container)
  // Videos
  '00000018': 'video/mp4',      // MP4 (ftyp box variant)
  '0000001c': 'video/mp4',      // MP4 (ftyp box variant)
  '00000020': 'video/mp4',      // MP4 (ftyp box variant)
  '1a45dfa3': 'video/webm',     // WebM/MKV (EBML)
  '52494646_avi': 'video/avi',  // AVI (RIFF container)
};

/**
 * Validate file magic bytes against expected types.
 * Returns true if the file's magic bytes match an expected type.
 */
function validateMagicBytes(filePath, expectedCategory) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(12);
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex').toLowerCase();

    if (expectedCategory === 'image') {
      // Check JPEG (FF D8 FF)
      if (hex.startsWith('ffd8ff')) return true;
      // Check PNG (89 50 4E 47)
      if (hex.startsWith('89504e47')) return true;
      // Check GIF (47 49 46 38)
      if (hex.startsWith('47494638')) return true;
      // Check WebP (RIFF....WEBP)
      if (hex.startsWith('52494646') && buffer.toString('ascii', 8, 12) === 'WEBP') return true;
    }

    if (expectedCategory === 'video') {
      // Check MP4/MOV (ftyp box — byte 4-7 should be 'ftyp')
      if (buffer.toString('ascii', 4, 8) === 'ftyp') return true;
      // Check WebM/MKV (EBML header: 1A 45 DF A3)
      if (hex.startsWith('1a45dfa3')) return true;
      // Check AVI (RIFF....AVI )
      if (hex.startsWith('52494646') && buffer.toString('ascii', 8, 12).startsWith('AVI')) return true;
      // Check FLV (46 4C 56)
      if (hex.startsWith('464c56')) return true;
      // Check WMV/ASF (30 26 B2 75)
      if (hex.startsWith('3026b275')) return true;
    }

    return false;
  } catch (error) {
    console.error('Magic byte validation error:', error);
    return false;
  }
}

/**
 * Check for double extension attacks (e.g., file.php.jpg)
 */
function hasDoubleExtension(filename) {
  const dangerousExtensions = ['.php', '.exe', '.sh', '.bat', '.cmd', '.ps1', '.py', '.rb', '.pl', '.cgi', '.asp', '.aspx', '.jsp'];
  const lowerName = filename.toLowerCase();
  return dangerousExtensions.some(ext => lowerName.includes(ext));
}

/**
 * Sanitize filename — remove potentially dangerous characters
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace special chars with underscore
    .replace(/\.{2,}/g, '.');            // Remove consecutive dots
}

// Configure storage for thumbnails
const thumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadsBase, 'thumbnails'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeExt = path.extname(sanitizeFilename(file.originalname));
    cb(null, 'thumbnail-' + uniqueSuffix + safeExt);
  }
});

// Configure storage for videos
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadsBase, 'videos'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeExt = path.extname(sanitizeFilename(file.originalname));
    cb(null, 'video-' + uniqueSuffix + safeExt);
  }
});

// File filter for images (thumbnails) — extension + mimetype + double-extension check
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  // Check for double extension attacks
  if (hasDoubleExtension(file.originalname)) {
    return cb(new Error('Suspicious filename detected. Upload rejected.'));
  }

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// File filter for videos — extension + mimetype + double-extension check
const videoFilter = (req, file, cb) => {
  const allowedTypes = /mp4|avi|mov|wmv|flv|mkv|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /video/.test(file.mimetype);

  // Check for double extension attacks
  if (hasDoubleExtension(file.originalname)) {
    return cb(new Error('Suspicious filename detected. Upload rejected.'));
  }

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed (mp4, avi, mov, wmv, flv, mkv, webm)'));
  }
};

// Multer upload configurations
const uploadThumbnail = multer({
  storage: thumbnailStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for thumbnails
  }
});

const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit for videos
  }
});

/**
 * Post-upload middleware to validate magic bytes.
 * Use this after multer middleware to verify the file content.
 */
const validateUploadedImage = (req, res, next) => {
  if (!req.file) return next();

  if (!validateMagicBytes(req.file.path, 'image')) {
    // Delete the invalid file
    fs.unlinkSync(req.file.path);
    if (req.logSecurity) {
      req.logSecurity('FILE_UPLOAD', {
        reason: 'magic_byte_mismatch',
        originalname: req.file.originalname,
        mimetype: req.file.mimetype
      });
    }
    return res.status(400).json({
      success: false,
      message: 'File content does not match expected image type. Upload rejected.'
    });
  }
  next();
};

const validateUploadedVideo = (req, res, next) => {
  if (!req.file) return next();

  if (!validateMagicBytes(req.file.path, 'video')) {
    // Delete the invalid file
    fs.unlinkSync(req.file.path);
    if (req.logSecurity) {
      req.logSecurity('FILE_UPLOAD', {
        reason: 'magic_byte_mismatch',
        originalname: req.file.originalname,
        mimetype: req.file.mimetype
      });
    }
    return res.status(400).json({
      success: false,
      message: 'File content does not match expected video type. Upload rejected.'
    });
  }
  next();
};

module.exports = {
  uploadThumbnail,
  uploadVideo,
  validateUploadedImage,
  validateUploadedVideo,
  validateMagicBytes,
  hasDoubleExtension,
  sanitizeFilename
};
