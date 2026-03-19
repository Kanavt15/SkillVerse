const express = require('express');
const router = express.Router();
const { param, body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth.middleware');
const {
  getGamificationStats,
  getXPHistory,
  getStreakDetails,
  buyStreakFreeze,
  getBadges,
  getAllAvailableBadges,
  featureBadge,
  getLeaderboard,
  updateTimezone,
  getActivityHistory
} = require('../controllers/gamification.controller');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// Validation rules
const badgeIdValidation = [
  param('badgeId').isInt({ min: 1 }).withMessage('Invalid badge ID')
];

const timezoneValidation = [
  body('timezone').notEmpty().withMessage('Timezone is required')
];

const leaderboardValidation = [
  query('type').optional().isIn(['xp', 'streak', 'level']).withMessage('Invalid leaderboard type'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
];

const activityValidation = [
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
];

// --- Stats & Overview ---
// GET /api/gamification/stats - Get XP, level, streak overview
router.get('/stats', auth, getGamificationStats);

// GET /api/gamification/xp/history - Paginated XP transaction history
router.get('/xp/history', auth, paginationValidation, validate, getXPHistory);

// --- Streaks ---
// GET /api/gamification/streak - Detailed streak info
router.get('/streak', auth, getStreakDetails);

// POST /api/gamification/streak/freeze - Purchase streak freeze (costs 100 points)
router.post('/streak/freeze', auth, buyStreakFreeze);

// --- Badges ---
// GET /api/gamification/badges - User's earned badges
router.get('/badges', auth, getBadges);

// GET /api/gamification/badges/all - All available badges (for showcase)
router.get('/badges/all', auth, getAllAvailableBadges);

// PUT /api/gamification/badges/:badgeId/feature - Toggle featured badge
router.put('/badges/:badgeId/feature', auth, badgeIdValidation, validate, featureBadge);

// --- Leaderboard ---
// GET /api/gamification/leaderboard?type=xp|streak|level&limit=50
router.get('/leaderboard', auth, leaderboardValidation, validate, getLeaderboard);

// --- Activity ---
// GET /api/gamification/activity?days=30 - Daily activity history
router.get('/activity', auth, activityValidation, validate, getActivityHistory);

// --- Settings ---
// PUT /api/gamification/timezone - Update user timezone
router.put('/timezone', auth, timezoneValidation, validate, updateTimezone);

module.exports = router;
