const { body, validationResult } = require('express-validator');

// Middleware to check validation results and format response
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

const registerValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  validate,
];

const loginValidation = [
  body('identifier')
    .trim()
    .notEmpty().withMessage('Username or email is required'),
  body('password')
    .notEmpty().withMessage('Password is required'),
  validate,
];

const postValidation = [
  body('text')
    .trim()
    .custom((val, { req }) => {
      // If image is uploaded, text can be empty; otherwise text is required
      if (!val && !req.file) {
        throw new Error('Post must have either text or an image');
      }
      if (val && val.length > 1000) {
        throw new Error('Post text cannot exceed 1000 characters');
      }
      return true;
    }),
  validate,
];

const commentValidation = [
  body('text')
    .trim()
    .notEmpty().withMessage('Comment cannot be empty')
    .isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters'),
  validate,
];

const profileUpdateValidation = [
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Bio cannot exceed 200 characters'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  validate,
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  postValidation,
  commentValidation,
  profileUpdateValidation,
};
