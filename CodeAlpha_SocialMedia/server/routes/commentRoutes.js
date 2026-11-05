const express = require('express');
const router = express.Router();
const {
  getPostComments,
  addComment,
  deleteComment,
} = require('../controllers/commentController');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { commentValidation } = require('../middleware/validators');

router.get('/post/:postId', optionalAuth, getPostComments);
router.post('/post/:postId', requireAuth, commentValidation, addComment);
router.delete('/:id', requireAuth, deleteComment);

module.exports = router;
