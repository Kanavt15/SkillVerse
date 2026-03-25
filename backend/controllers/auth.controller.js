const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { validationResult } = require('express-validator');
const {
  generateAccessToken,
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeTokenFamily,
  revokeAllUserTokens
} = require('../utils/token.utils');
const { getRefreshCookieOptions, getClearCookieOptions } = require('../utils/cookie.utils');

// Register new user
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, full_name, role = 'learner' } = req.body;

    // Whitelist allowed roles
    const allowedRoles = ['learner', 'instructor', 'both'];
    const safeRole = allowedRoles.includes(role) ? role : 'learner';

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      // Generic message to prevent user enumeration
      return res.status(400).json({
        success: false,
        message: 'Registration failed. Please try a different email.'
      });
    }

    // Hash password with bcrypt (12 rounds for stronger hashing)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user with default 500 points
    const defaultPoints = 500;
    const [result] = await pool.query(
      'INSERT INTO users (email, password, full_name, role, points) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, full_name, safeRole, defaultPoints]
    );

    // Record welcome bonus transaction
    await pool.query(
      'INSERT INTO point_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
      [result.insertId, defaultPoints, 'bonus', 'Welcome bonus - start your learning journey!']
    );

    const user = { id: result.insertId, email, role: safeRole };

    // Generate access token and refresh token
    const accessToken = generateAccessToken(user);
    const { token: refreshToken } = await generateRefreshToken(user.id, null, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    // Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      user: {
        id: result.insertId,
        email,
        full_name,
        role: safeRole,
        points: defaultPoints
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const [users] = await pool.query(
      'SELECT id, email, password, full_name, role, bio, profile_image, points FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      // Log failed login attempt
      if (req.logSecurity) {
        req.logSecurity('AUTH_FAILURE', { reason: 'user_not_found', email });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Log failed login attempt
      if (req.logSecurity) {
        req.logSecurity('AUTH_FAILURE', { reason: 'wrong_password', email });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate access token and refresh token
    const accessToken = generateAccessToken(user);
    const { token: refreshToken } = await generateRefreshToken(user.id, null, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    // Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

    // Remove password from response
    delete user.password;

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    });
  }
};

// Refresh access token
const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    const validation = await validateRefreshToken(refreshToken);

    if (!validation.valid) {
      // Clear invalid cookie
      res.clearCookie('refreshToken', getClearCookieOptions());

      if (req.logSecurity) {
        req.logSecurity('AUTH_FAILURE', { reason: 'invalid_refresh_token', error: validation.error });
      }

      return res.status(401).json({
        success: false,
        message: validation.error,
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Revoke old token (part of rotation)
    await revokeRefreshToken(validation.tokenId);

    // Generate new token pair with same family
    const newAccessToken = generateAccessToken(validation.user);
    const { token: newRefreshToken } = await generateRefreshToken(
      validation.userId,
      validation.familyId, // Same family for rotation tracking
      { userAgent: req.headers['user-agent'], ipAddress: req.ip }
    );

    // Set new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());

    res.json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing token'
    });
  }
};

// Logout (single session)
const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      const validation = await validateRefreshToken(refreshToken);
      if (validation.valid) {
        // Revoke entire token family (this session's chain)
        await revokeTokenFamily(validation.familyId);
      }
    }

    res.clearCookie('refreshToken', getClearCookieOptions());
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookie even if DB operation fails
    res.clearCookie('refreshToken', getClearCookieOptions());
    res.json({ success: true, message: 'Logged out' });
  }
};

// Logout from all devices
const logoutAll = async (req, res) => {
  try {
    await revokeAllUserTokens(req.user.id);
    res.clearCookie('refreshToken', getClearCookieOptions());
    res.json({ success: true, message: 'Logged out from all devices' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging out'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, email, full_name, role, bio, profile_image, points, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { full_name, bio, role } = req.body;
    const userId = req.user.id;

    const updates = [];
    const values = [];

    if (full_name) {
      // Enforce max length
      if (full_name.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Full name must be 100 characters or less'
        });
      }
      updates.push('full_name = ?');
      values.push(full_name);
    }
    if (bio !== undefined) {
      // Enforce max length
      if (bio.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Bio must be 500 characters or less'
        });
      }
      updates.push('bio = ?');
      values.push(bio);
    }
    if (role && ['learner', 'instructor', 'both'].includes(role)) {
      updates.push('role = ?');
      values.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(userId);

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated user
    const [users] = await pool.query(
      'SELECT id, email, full_name, role, bio, profile_image FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: users[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getProfile,
  updateProfile
};
