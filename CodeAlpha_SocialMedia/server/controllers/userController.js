const Store = require('../models/store');

// @desc    Get user profile by username
// @route   GET /api/users/profile/:username
// @access  Public (optional auth for follow status)
const getUserProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const user = await Store.findUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const currentUserId = req.user ? req.user._id.toString() : null;
    const isFollowing = currentUserId
      ? (user.followers || []).map(String).includes(currentUserId)
      : false;
    const isSelf = currentUserId === user._id.toString();

    // Get user's post count
    const postsResult = await Store.getUserPosts({
      userId: user._id,
      page: 1,
      limit: 1,
    });

    res.status(200).json({
      success: true,
      profile: {
        ...user,
        followersCount: (user.followers || []).length,
        followingCount: (user.following || []).length,
        postsCount: postsResult.pagination.total,
        isFollowing,
        isSelf,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update current user's profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const updateData = {};
    if (req.body.bio !== undefined) updateData.bio = req.body.bio;
    if (req.body.username !== undefined) updateData.username = req.body.username;

    // If an avatar file was uploaded
    if (req.file) {
      updateData.avatar = `/uploads/${req.file.filename}`;
    } else if (req.body.avatar) {
      updateData.avatar = req.body.avatar;
    }

    const updatedUser = await Store.updateUserProfile(req.user._id, updateData);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Follow a user
// @route   POST /api/users/:id/follow
// @access  Private
const followUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    await Store.followUser(req.user._id, targetUserId);

    res.status(200).json({
      success: true,
      message: 'User followed successfully',
      isFollowing: true,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/users/:id/follow
// @access  Private
const unfollowUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    await Store.unfollowUser(req.user._id, targetUserId);

    res.status(200).json({
      success: true,
      message: 'User unfollowed successfully',
      isFollowing: false,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user followers
// @route   GET /api/users/:id/followers
// @access  Public (optional auth)
const getFollowers = async (req, res, next) => {
  try {
    const followers = await Store.getFollowers(req.params.id);
    const curId = req.user ? req.user._id.toString() : null;

    const formatted = followers.map((u) => ({
      ...u,
      isFollowing: curId ? (u.followers || []).map(String).includes(curId) : false,
      isSelf: curId === u._id.toString(),
    }));

    res.status(200).json({
      success: true,
      followers: formatted,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user following
// @route   GET /api/users/:id/following
// @access  Public (optional auth)
const getFollowing = async (req, res, next) => {
  try {
    const following = await Store.getFollowing(req.params.id);
    const curId = req.user ? req.user._id.toString() : null;

    const formatted = following.map((u) => ({
      ...u,
      isFollowing: curId ? (u.followers || []).map(String).includes(curId) : false,
      isSelf: curId === u._id.toString(),
    }));

    res.status(200).json({
      success: true,
      following: formatted,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Search users by username or bio
// @route   GET /api/users/search
// @access  Public
const searchUsers = async (req, res, next) => {
  try {
    const { q = '', limit = 10 } = req.query;
    const users = await Store.searchUsers(q, parseInt(limit, 10));
    const curId = req.user ? req.user._id.toString() : null;

    const formatted = users.map((u) => ({
      ...u,
      isFollowing: curId ? (u.followers || []).map(String).includes(curId) : false,
      isSelf: curId === u._id.toString(),
    }));

    res.status(200).json({
      success: true,
      users: formatted,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get suggested users to follow
// @route   GET /api/users/suggested
// @access  Public (optional auth)
const getSuggestedUsers = async (req, res, next) => {
  try {
    const curId = req.user ? req.user._id.toString() : null;
    const users = await Store.searchUsers('', 20);

    // Filter out current user and already followed users if authenticated
    let filtered = users;
    if (curId) {
      const curUser = await Store.findUserById(curId);
      const followingSet = new Set((curUser.following || []).map(String));
      filtered = users.filter(
        (u) => u._id.toString() !== curId && !followingSet.has(u._id.toString())
      );
    }

    res.status(200).json({
      success: true,
      suggested: filtered.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUserProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  searchUsers,
  getSuggestedUsers,
};
