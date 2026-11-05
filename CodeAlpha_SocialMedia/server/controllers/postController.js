const Store = require('../models/store');

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res, next) => {
  try {
    const { text } = req.body;
    let image = null;

    if (req.file) {
      image = `/uploads/${req.file.filename}`;
    } else if (req.body.image) {
      image = req.body.image;
    }

    if (!text && !image) {
      return res.status(400).json({
        success: false,
        message: 'Post must contain either text or an image.',
      });
    }

    const post = await Store.createPost({
      authorId: req.user._id,
      text: text ? text.trim() : '',
      image,
    });

    res.status(201).json({
      success: true,
      message: 'Post published successfully!',
      post: {
        ...post,
        isLiked: false,
        likesCount: 0,
        commentsCount: 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get home feed (posts from followed users + own posts)
// @route   GET /api/posts/feed
// @access  Private
const getHomeFeed = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const result = await Store.getHomeFeed({
      userId: req.user._id,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get explore feed (all posts, searchable)
// @route   GET /api/posts/explore
// @access  Public (optional auth for like status)
const getExplorePosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';
    const currentUserId = req.user ? req.user._id : null;

    const result = await Store.getExplorePosts({
      currentUserId,
      page,
      limit,
      search,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get posts by a specific user
// @route   GET /api/posts/user/:username
// @access  Public (optional auth for like status)
const getUserPosts = async (req, res, next) => {
  try {
    const { username } = req.params;
    const user = await Store.findUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const currentUserId = req.user ? req.user._id : null;

    const result = await Store.getUserPosts({
      userId: user._id,
      currentUserId,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      user,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single post by ID
// @route   GET /api/posts/:id
// @access  Public (optional auth for like status)
const getPostById = async (req, res, next) => {
  try {
    const post = await Store.getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const currentUserId = req.user ? req.user._id.toString() : null;
    const isLiked = currentUserId
      ? (post.likes || []).map(String).includes(currentUserId)
      : false;

    res.status(200).json({
      success: true,
      post: {
        ...post,
        isLiked,
        likesCount: (post.likes || []).length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete post (author only)
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res, next) => {
  try {
    await Store.deletePost(req.params.id, req.user._id);

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
      deletedPostId: req.params.id,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle like / unlike on a post
// @route   POST /api/posts/:id/like
// @access  Private
const toggleLikePost = async (req, res, next) => {
  try {
    const result = await Store.toggleLike(req.params.id, req.user._id);

    res.status(200).json({
      success: true,
      liked: result.liked,
      likesCount: result.likesCount,
      message: result.liked ? 'Post liked!' : 'Post unliked',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Unlike a post (explicit DELETE route)
// @route   DELETE /api/posts/:id/like
// @access  Private
const unlikePost = async (req, res, next) => {
  try {
    const post = await Store.getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const hasLiked = (post.likes || []).map(String).includes(req.user._id.toString());
    if (hasLiked) {
      const result = await Store.toggleLike(req.params.id, req.user._id);
      return res.status(200).json({
        success: true,
        liked: false,
        likesCount: result.likesCount,
        message: 'Post unliked',
      });
    }

    res.status(200).json({
      success: true,
      liked: false,
      likesCount: (post.likes || []).length,
      message: 'Post was not liked',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPost,
  getHomeFeed,
  getExplorePosts,
  getUserPosts,
  getPostById,
  deletePost,
  toggleLikePost,
  unlikePost,
};
