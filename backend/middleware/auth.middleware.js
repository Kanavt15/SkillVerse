const jwt = require('jsonwebtoken');

// JWT verification options (must match signing options)
const JWT_VERIFY_OPTIONS = {
  issuer: 'skillverse',
  audience: 'skillverse-client'
};

// Verify JWT token middleware
const auth = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token, access denied'
      });
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token, access denied'
      });
    }

    // Verify token with issuer/audience validation
    const decoded = jwt.verify(token, process.env.JWT_SECRET, JWT_VERIFY_OPTIONS);

    // Validate token isn't issued in the future (clock skew protection)
    if (decoded.iat && decoded.iat > Math.floor(Date.now() / 1000) + 60) {
      if (req.logSecurity) {
        req.logSecurity('AUTH_FAILURE', { reason: 'future_token', userId: decoded.id });
      }
      return res.status(401).json({
        success: false,
        message: 'Token is invalid'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    // Log the authentication failure
    if (req.logSecurity) {
      req.logSecurity('AUTH_FAILURE', {
        reason: error.name === 'TokenExpiredError' ? 'token_expired' : 'invalid_token',
        errorName: error.name
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.'
      });
    }

    res.status(401).json({
      success: false,
      message: 'Token is invalid or expired'
    });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role) && req.user.role !== 'both') {
      if (req.logSecurity) {
        req.logSecurity('AUTH_FAILURE', {
          reason: 'insufficient_permissions',
          userId: req.user.id,
          requiredRoles: roles,
          userRole: req.user.role
        });
      }
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Check if user is instructor
const isInstructor = (req, res, next) => {
  if (req.user.role === 'instructor' || req.user.role === 'both') {
    next();
  } else {
    if (req.logSecurity) {
      req.logSecurity('AUTH_FAILURE', {
        reason: 'not_instructor',
        userId: req.user.id,
        userRole: req.user.role
      });
    }
    res.status(403).json({
      success: false,
      message: 'Access denied. Instructor role required.'
    });
  }
};

// Check if user is learner
const isLearner = (req, res, next) => {
  if (req.user.role === 'learner' || req.user.role === 'both') {
    next();
  } else {
    if (req.logSecurity) {
      req.logSecurity('AUTH_FAILURE', {
        reason: 'not_learner',
        userId: req.user.id,
        userRole: req.user.role
      });
    }
    res.status(403).json({
      success: false,
      message: 'Access denied. Learner role required.'
    });
  }
};

module.exports = {
  auth,
  authorize,
  isInstructor,
  isLearner
};
