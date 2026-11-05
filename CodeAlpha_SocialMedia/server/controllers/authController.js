const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Store = require('../models/store');

const JWT_SECRET = process.env.JWT_SECRET || 'codealpha_super_secret_jwt_key_2026_dev_secure_random';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { username, email, password, bio, avatar } = req.body;

    // Check if email already registered
    const existingEmail = await Store.findUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Check if username taken
    const existingUsername = await Store.findUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'That username is already taken. Please choose another.',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await Store.createUser({
      username,
      email,
      passwordHash,
      bio: bio || `Hello! I'm ${username} on CodeAlpha Social.`,
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
    });

    // Generate token
    const token = generateToken(newUser._id);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      token,
      user: newUser,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Log in an existing user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    // Find user by either email or username (including password)
    let user = null;
    if (identifier.includes('@')) {
      user = await Store.findUserByEmail(identifier, true);
    } else {
      // Find by username
      if (Store.isMongooseActive()) {
        const User = require('../models/User');
        user = await User.findOne({
          username: { $regex: new RegExp(`^${identifier.trim()}$`, 'i') },
        }).select('+passwordHash');
      } else {
        const safeUser = await Store.findUserByUsername(identifier);
        if (safeUser) {
          user = await Store.findUserById(safeUser._id, true);
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.',
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.',
      });
    }

    const token = generateToken(user._id);
    const safeUser = user.toSafeObject ? user.toSafeObject() : { ...user };
    delete safeUser.passwordHash;

    res.status(200).json({
      success: true,
      message: 'Welcome back!',
      token,
      user: safeUser,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current authenticated user info
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await Store.findUserById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
};
