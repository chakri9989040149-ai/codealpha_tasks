const express = require('express');
const router = express.Router();
const {
  createPost,
  getHomeFeed,
  getExplorePosts,
  getUserPosts,
  getPostById,
  deletePost,
  toggleLikePost,
  unlikePost,
} = require('../controllers/postController');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { postValidation } = require('../middleware/validators');

router.get('/feed', requireAuth, getHomeFeed);
router.get('/explore', optionalAuth, getExplorePosts);
router.get('/user/:username', optionalAuth, getUserPosts);
router.get('/:id', optionalAuth, getPostById);
router.post(
  '/',
  requireAuth,
  upload.single('image'),
  postValidation,
  createPost
);
router.delete('/:id', requireAuth, deletePost);
router.post('/:id/like', requireAuth, toggleLikePost);
router.delete('/:id/like', requireAuth, unlikePost);

module.exports = router;
