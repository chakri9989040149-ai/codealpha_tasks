const jwt = require('jsonwebtoken');
const Store = require('../models/store');

const JWT_SECRET = process.env.JWT_SECRET || 'codealpha_super_secret_jwt_key_2026_dev_secure_random';

// Protect routes requiring authentication
const requireAuth = async (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required. Please log in.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await Store.findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Account no longer exists. Please register or log in again.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization token',
      });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authorization token has expired. Please log in again.',
      });
    }
    next(err);
  }
};

// Optional auth (populates req.user if valid token provided, but doesn't block if missing)
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await Store.findUserById(decoded.id);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (err) {
    // If invalid token in optional route, just continue as unauthenticated
    next();
  }
};

module.exports = {
  requireAuth,
  optionalAuth,
};
