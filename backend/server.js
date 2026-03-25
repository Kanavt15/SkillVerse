const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { testConnection, runMigrations } = require('./config/database');
const { initRedis, getRedisClient, isRedisAvailable } = require('./config/redis');
const { sanitizeInput, securityLogger, validateContentType, requestId } = require('./middleware/security.middleware');
const { initGamificationCronJobs } = require('./cron/gamification.cron');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const courseRoutes = require('./routes/course.routes');
const lessonRoutes = require('./routes/lesson.routes');
const enrollmentRoutes = require('./routes/enrollment.routes');
const categoryRoutes = require('./routes/category.routes');
const pointsRoutes = require('./routes/points.routes');
const reviewRoutes = require('./routes/review.routes');
const certificateRoutes = require('./routes/certificate.routes');
const discussionRoutes = require('./routes/discussion.routes');
const notificationRoutes = require('./routes/notification.routes');
const followerRoutes = require('./routes/follower.routes');
const gamificationRoutes = require('./routes/gamification.routes');
const instructorRoutes = require('./routes/instructor.routes');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = initSocket(server);

// ============================
// Security Middleware Stack
// ============================

// Request ID for tracing
app.use(requestId);

// Security event logger (attaches req.logSecurity)
app.use(securityLogger);

// Hardened Helmet configuration
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", process.env.CLIENT_URL || 'http://localhost:3000'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xDnsPrefetchControl: { allow: false },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' }
}));

// CORS configuration (must be before rate limiter so blocked responses still have CORS headers)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // Cache preflight for 24 hours
}));

// HTTP Parameter Pollution protection
app.use(hpp());

// Helper function to create rate limiter with Redis or fallback
const createRateLimiter = (options) => {
  const baseOptions = {
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  };

  // If Redis is available, use Redis store
  if (isRedisAvailable()) {
    const { RedisStore } = require('rate-limit-redis');
    const redisClient = getRedisClient();
    baseOptions.store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `rl:${options.name || 'default'}:`
    });
    console.log(`🔴 Rate limiter "${options.name}" using Redis store`);
  } else {
    console.log(`⚠️ Rate limiter "${options.name}" using in-memory store (Redis unavailable)`);
  }

  return rateLimit(baseOptions);
};

// Global rate limiting (exclude streaming and preflight OPTIONS)
const globalLimiter = createRateLimiter({
  name: 'global',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  skip: (req) => req.method === 'OPTIONS' || req.path.startsWith('/api/stream/'),
  handler: (req, res) => {
    req.logSecurity('RATE_LIMIT', { limiter: 'global' });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.'
    });
  }
});
app.use('/api/', globalLimiter);

// Strict auth-specific rate limiter (brute-force protection)
const authLimiter = createRateLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 login/register attempts per 15 min per IP
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    req.logSecurity('RATE_LIMIT', { limiter: 'auth', email: req.body?.email });
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again in 15 minutes.'
    });
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parser middleware with size limits (DoS protection)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parser (must be before routes that use cookies)
app.use(cookieParser());

// XSS input sanitization (after body parsers, before routes)
app.use(sanitizeInput);

// Content-type validation
app.use(validateContentType);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================
// API Routes
// ============================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/followers', followerRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/instructors', instructorRoutes);

// ============================
// Video streaming endpoint with Range support
// ============================
app.get('/api/stream/video/:filename', (req, res) => {
  // Sanitize filename — strip path traversal and allow only safe characters
  const rawFilename = req.params.filename;
  const filename = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '');

  if (!filename || filename !== path.basename(rawFilename)) {
    req.logSecurity('SUSPICIOUS', { reason: 'path_traversal_attempt', filename: rawFilename });
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  const videoPath = path.join(__dirname, 'uploads', 'videos', filename);
  const resolvedPath = path.resolve(videoPath);
  const allowedDir = path.resolve(path.join(__dirname, 'uploads', 'videos'));

  // Path traversal protection: ensure resolved path is within allowed directory
  if (!resolvedPath.startsWith(allowedDir)) {
    req.logSecurity('SUSPICIOUS', { reason: 'path_traversal_attempt', filename: rawFilename });
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ success: false, message: 'Video not found' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Determine content type from extension
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska'
  };
  const contentType = mimeTypes[ext] || 'video/mp4';

  // CORS is handled by the global cors() middleware — no manual headers needed

  if (range) {
    // Validate Range header format
    const rangeMatch = range.match(/^bytes=(\d+)-(\d*)$/);
    if (!rangeMatch) {
      return res.status(416).json({ success: false, message: 'Invalid Range header' });
    }

    const start = parseInt(rangeMatch[1], 10);
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).json({ success: false, message: 'Range not satisfiable' });
    }

    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(videoPath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    });
    stream.pipe(res);
  } else {
    // Full file
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
    });
    fs.createReadStream(videoPath).pipe(res);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'SkillVerse API is running' });
});

// ============================
// Error handling
// ============================
app.use((err, req, res, next) => {
  // Log the full error internally
  console.error(`[ERROR] ${req.requestId || 'no-id'}:`, err.stack);

  // Never leak stack traces to the client
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    requestId: req.requestId
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ============================
// Start server
// ============================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Initialize Redis (optional - fallback to in-memory if unavailable)
    await initRedis();

    // Test database connection
    await testConnection();

    // Run database migrations
    await runMigrations();

    // Initialize gamification cron jobs
    initGamificationCronJobs();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔒 Security middleware: Helmet, CORS, HPP, Rate Limiting, XSS Sanitization`);
      console.log(`🔌 WebSocket: Socket.io enabled`);
      console.log(`⏰ Gamification cron jobs: Initialized`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
