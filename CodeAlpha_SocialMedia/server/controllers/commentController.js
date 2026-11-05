const Store = require('../models/store');

// @desc    Get comments for a specific post
// @route   GET /api/comments/post/:postId
// @access  Public
const getPostComments = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const comments = await Store.getPostComments(postId);
    const curId = req.user ? req.user._id.toString() : null;

    const formatted = comments.map((c) => {
      const obj = c.toJSON ? c.toJSON() : { ...c };
      const authorId = obj.author ? (obj.author._id || obj.author).toString() : '';
      return {
        ...obj,
        isOwnComment: curId === authorId,
      };
    });

    res.status(200).json({
      success: true,
      comments: formatted,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add a comment to a post
// @route   POST /api/comments/post/:postId
// @access  Private
const addComment = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment text cannot be empty.',
      });
    }

    const comment = await Store.createComment({
      postId,
      authorId: req.user._id,
      text: text.trim(),
    });

    const obj = comment.toJSON ? comment.toJSON() : { ...comment };

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: {
        ...obj,
        isOwnComment: true,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a comment (author only)
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Store.deleteComment(id, req.user._id);

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
      deletedCommentId: id,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPostComments,
  addComment,
  deleteComment,
};
