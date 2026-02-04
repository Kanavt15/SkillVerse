const jwt = require('jsonwebtoken');

// Verify JWT token middleware
const auth = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token, access denied'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
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
