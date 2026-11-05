const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getIsConnected } = require('../config/db');
const User = require('./User');
const Post = require('./Post');
const Comment = require('./Comment');

// Helper to generate 24-char hex ObjectId for in-memory documents
const generateId = () => crypto.randomBytes(12).toString('hex');

// In-Memory store arrays
const memUsers = [];
const memPosts = [];
const memComments = [];

// Helper to format in-memory user safe object
const sanitizeUser = (user) => {
  if (!user) return null;
  const copy = { ...user };
  delete copy.passwordHash;
  return copy;
};

// Store Interface
const Store = {
  // Check if native mongoose is active
  isMongooseActive() {
    return getIsConnected() && mongoose.connection.readyState === 1;
  },

  // USER OPERATIONS
  async createUser(data) {
    if (this.isMongooseActive()) {
      const user = await User.create(data);
      return user.toSafeObject ? user.toSafeObject() : sanitizeUser(user.toJSON());
    }

    // In-memory
    const existing = memUsers.find(
      (u) =>
        u.email.toLowerCase() === data.email.toLowerCase() ||
        u.username.toLowerCase() === data.username.toLowerCase()
    );
    if (existing) {
      const err = new Error(
        existing.email.toLowerCase() === data.email.toLowerCase()
          ? 'Email already in use'
          : 'Username already taken'
      );
      err.statusCode = 400;
      throw err;
    }

    const newUser = {
      _id: generateId(),
      username: data.username.trim(),
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash,
      bio: data.bio || '',
      avatar: data.avatar || '/uploads/default-avatar.svg',
      followers: [],
      following: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memUsers.push(newUser);
    return sanitizeUser(newUser);
  },

  async findUserById(id, includePassword = false) {
    if (!id) return null;
    const idStr = id.toString();
    if (this.isMongooseActive()) {
      const query = User.findById(idStr);
      if (includePassword) query.select('+passwordHash');
      const user = await query.exec();
      if (!user) return null;
      return includePassword ? user : (user.toSafeObject ? user.toSafeObject() : sanitizeUser(user.toJSON()));
    }

    const user = memUsers.find((u) => u._id.toString() === idStr);
    if (!user) return null;
    return includePassword ? { ...user } : sanitizeUser(user);
  },

  async findUserByEmail(email, includePassword = false) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    if (this.isMongooseActive()) {
      const query = User.findOne({ email: cleanEmail });
      if (includePassword) query.select('+passwordHash');
      const user = await query.exec();
      if (!user) return null;
      return includePassword ? user : (user.toSafeObject ? user.toSafeObject() : sanitizeUser(user.toJSON()));
    }

    const user = memUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) return null;
    return includePassword ? { ...user } : sanitizeUser(user);
  },

  async findUserByUsername(username) {
    if (!username) return null;
    const cleanUsername = username.trim().toLowerCase();
    if (this.isMongooseActive()) {
      const user = await User.findOne({
        username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') },
      });
      return user ? (user.toSafeObject ? user.toSafeObject() : sanitizeUser(user.toJSON())) : null;
    }

    const user = memUsers.find((u) => u.username.toLowerCase() === cleanUsername);
    return sanitizeUser(user);
  },

  async updateUserProfile(userId, updateData) {
    const idStr = userId.toString();
    if (this.isMongooseActive()) {
      const user = await User.findByIdAndUpdate(
        idStr,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      return user ? (user.toSafeObject ? user.toSafeObject() : sanitizeUser(user.toJSON())) : null;
    }

    const user = memUsers.find((u) => u._id.toString() === idStr);
    if (!user) return null;

    if (updateData.username && updateData.username.toLowerCase() !== user.username.toLowerCase()) {
      const conflict = memUsers.find(
        (u) => u._id.toString() !== idStr && u.username.toLowerCase() === updateData.username.toLowerCase()
      );
      if (conflict) {
        const err = new Error('Username already taken');
        err.statusCode = 400;
        throw err;
      }
      user.username = updateData.username.trim();
    }

    if (updateData.bio !== undefined) user.bio = updateData.bio.trim();
    if (updateData.avatar !== undefined) user.avatar = updateData.avatar;
    user.updatedAt = new Date();

    return sanitizeUser(user);
  },

  async followUser(currentUserId, targetUserId) {
    const curId = currentUserId.toString();
    const tarId = targetUserId.toString();

    if (curId === tarId) {
      const err = new Error('You cannot follow yourself');
      err.statusCode = 400;
      throw err;
    }

    if (this.isMongooseActive()) {
      await User.findByIdAndUpdate(curId, { $addToSet: { following: tarId } });
      await User.findByIdAndUpdate(tarId, { $addToSet: { followers: curId } });
      return true;
    }

    const currentUser = memUsers.find((u) => u._id.toString() === curId);
    const targetUser = memUsers.find((u) => u._id.toString() === tarId);

    if (!currentUser || !targetUser) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    if (!currentUser.following.some((id) => id.toString() === tarId)) {
      currentUser.following.push(tarId);
    }
    if (!targetUser.followers.some((id) => id.toString() === curId)) {
      targetUser.followers.push(curId);
    }
    return true;
  },

  async unfollowUser(currentUserId, targetUserId) {
    const curId = currentUserId.toString();
    const tarId = targetUserId.toString();

    if (this.isMongooseActive()) {
      await User.findByIdAndUpdate(curId, { $pull: { following: tarId } });
      await User.findByIdAndUpdate(tarId, { $pull: { followers: curId } });
      return true;
    }

    const currentUser = memUsers.find((u) => u._id.toString() === curId);
    const targetUser = memUsers.find((u) => u._id.toString() === tarId);

    if (currentUser) {
      currentUser.following = currentUser.following.filter((id) => id.toString() !== tarId);
    }
    if (targetUser) {
      targetUser.followers = targetUser.followers.filter((id) => id.toString() !== curId);
    }
    return true;
  },

  async getFollowers(userId) {
    const idStr = userId.toString();
    if (this.isMongooseActive()) {
      const user = await User.findById(idStr).populate(
        'followers',
        '_id username avatar bio'
      );
      return user ? user.followers : [];
    }

    const user = memUsers.find((u) => u._id.toString() === idStr);
    if (!user) return [];
    return memUsers
      .filter((u) => user.followers.map(String).includes(u._id.toString()))
      .map(sanitizeUser);
  },

  async getFollowing(userId) {
    const idStr = userId.toString();
    if (this.isMongooseActive()) {
      const user = await User.findById(idStr).populate(
        'following',
        '_id username avatar bio'
      );
      return user ? user.following : [];
    }

    const user = memUsers.find((u) => u._id.toString() === idStr);
    if (!user) return [];
    return memUsers
      .filter((u) => user.following.map(String).includes(u._id.toString()))
      .map(sanitizeUser);
  },

  async searchUsers(query, limit = 15) {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      if (this.isMongooseActive()) {
        const users = await User.find().limit(limit).select('_id username avatar bio followers following');
        return users;
      }
      return memUsers.slice(0, limit).map(sanitizeUser);
    }

    if (this.isMongooseActive()) {
      return User.find({
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { bio: { $regex: q, $options: 'i' } },
        ],
      })
        .limit(limit)
        .select('_id username avatar bio followers following');
    }

    return memUsers
      .filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.bio && u.bio.toLowerCase().includes(q))
      )
      .slice(0, limit)
      .map(sanitizeUser);
  },

  // POST OPERATIONS
  async createPost({ authorId, text, image }) {
    if (this.isMongooseActive()) {
      const post = await Post.create({
        author: authorId,
        text,
        image,
      });
      const populated = await Post.findById(post._id).populate('author', '_id username avatar bio');
      return populated;
    }

    const newPost = {
      _id: generateId(),
      author: authorId.toString(),
      text,
      image: image || null,
      likes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memPosts.unshift(newPost);

    // Return populated post
    const author = memUsers.find((u) => u._id.toString() === authorId.toString());
    return {
      ...newPost,
      author: sanitizeUser(author),
      likesCount: 0,
      commentsCount: 0,
    };
  },

  async getPostById(postId) {
    const idStr = postId.toString();
    if (this.isMongooseActive()) {
      return Post.findById(idStr).populate('author', '_id username avatar bio');
    }

    const post = memPosts.find((p) => p._id.toString() === idStr);
    if (!post) return null;
    const author = memUsers.find((u) => u._id.toString() === post.author.toString());
    const commentsCount = memComments.filter((c) => c.post.toString() === idStr).length;
    return {
      ...post,
      author: sanitizeUser(author),
      likesCount: post.likes.length,
      commentsCount,
    };
  },

  async deletePost(postId, userId) {
    const pId = postId.toString();
    const uId = userId.toString();

    if (this.isMongooseActive()) {
      const post = await Post.findById(pId);
      if (!post) {
        const err = new Error('Post not found');
        err.statusCode = 404;
        throw err;
      }
      if (post.author.toString() !== uId) {
        const err = new Error('Unauthorized to delete this post');
        err.statusCode = 403;
        throw err;
      }
      await Post.findByIdAndDelete(pId);
      await Comment.deleteMany({ post: pId });
      return true;
    }

    const index = memPosts.findIndex((p) => p._id.toString() === pId);
    if (index === -1) {
      const err = new Error('Post not found');
      err.statusCode = 404;
      throw err;
    }
    const post = memPosts[index];
    if (post.author.toString() !== uId) {
      const err = new Error('Unauthorized to delete this post');
      err.statusCode = 403;
      throw err;
    }

    memPosts.splice(index, 1);
    // Cascade delete comments
    for (let i = memComments.length - 1; i >= 0; i--) {
      if (memComments[i].post.toString() === pId) {
        memComments.splice(i, 1);
      }
    }
    return true;
  },

  async toggleLike(postId, userId) {
    const pId = postId.toString();
    const uId = userId.toString();

    if (this.isMongooseActive()) {
      const post = await Post.findById(pId);
      if (!post) {
        const err = new Error('Post not found');
        err.statusCode = 404;
        throw err;
      }

      const hasLiked = post.likes.some((id) => id.toString() === uId);
      if (hasLiked) {
        post.likes = post.likes.filter((id) => id.toString() !== uId);
      } else {
        post.likes.push(uId);
      }
      await post.save();
      return {
        liked: !hasLiked,
        likesCount: post.likes.length,
        likes: post.likes,
      };
    }

    const post = memPosts.find((p) => p._id.toString() === pId);
    if (!post) {
      const err = new Error('Post not found');
      err.statusCode = 404;
      throw err;
    }

    const likeIdx = post.likes.findIndex((id) => id.toString() === uId);
    const hasLiked = likeIdx !== -1;
    if (hasLiked) {
      post.likes.splice(likeIdx, 1);
    } else {
      post.likes.push(uId);
    }

    return {
      liked: !hasLiked,
      likesCount: post.likes.length,
      likes: post.likes,
    };
  },

  async getHomeFeed({ userId, page = 1, limit = 10 }) {
    const uId = userId.toString();
    const skip = (page - 1) * limit;

    if (this.isMongooseActive()) {
      const user = await User.findById(uId);
      const feedAuthors = [...(user.following || []), uId];
      const posts = await Post.find({ author: { $in: feedAuthors } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', '_id username avatar bio');

      const total = await Post.countDocuments({ author: { $in: feedAuthors } });

      // Attach comment count
      const postsWithCounts = await Promise.all(
        posts.map(async (p) => {
          const count = await Comment.countDocuments({ post: p._id });
          const obj = p.toJSON ? p.toJSON() : { ...p };
          obj.commentsCount = count;
          obj.isLiked = p.likes.some((id) => id.toString() === uId);
          return obj;
        })
      );

      return {
        posts: postsWithCounts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasMore: page * limit < total,
        },
      };
    }

    const user = memUsers.find((u) => u._id.toString() === uId);
    const followingIds = user ? user.following.map(String) : [];
    const feedAuthorIds = new Set([...followingIds, uId]);

    const matchingPosts = memPosts.filter((p) => feedAuthorIds.has(p.author.toString()));
    matchingPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = matchingPosts.length;
    const paginated = matchingPosts.slice(skip, skip + limit).map((p) => {
      const author = memUsers.find((u) => u._id.toString() === p.author.toString());
      const commentsCount = memComments.filter((c) => c.post.toString() === p._id.toString()).length;
      return {
        ...p,
        author: sanitizeUser(author),
        likesCount: p.likes.length,
        commentsCount,
        isLiked: p.likes.some((id) => id.toString() === uId),
      };
    });

    return {
      posts: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    };
  },

  async getExplorePosts({ currentUserId = null, page = 1, limit = 10, search = '' }) {
    const skip = (page - 1) * limit;
    const curId = currentUserId ? currentUserId.toString() : null;

    if (this.isMongooseActive()) {
      const query = search ? { text: { $regex: search, $options: 'i' } } : {};
      const posts = await Post.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', '_id username avatar bio');

      const total = await Post.countDocuments(query);

      const postsWithCounts = await Promise.all(
        posts.map(async (p) => {
          const count = await Comment.countDocuments({ post: p._id });
          const obj = p.toJSON ? p.toJSON() : { ...p };
          obj.commentsCount = count;
          obj.isLiked = curId ? p.likes.some((id) => id.toString() === curId) : false;
          return obj;
        })
      );

      return {
        posts: postsWithCounts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasMore: page * limit < total,
        },
      };
    }

    let matchingPosts = [...memPosts];
    if (search) {
      const q = search.toLowerCase();
      matchingPosts = matchingPosts.filter((p) => p.text.toLowerCase().includes(q));
    }
    matchingPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = matchingPosts.length;
    const paginated = matchingPosts.slice(skip, skip + limit).map((p) => {
      const author = memUsers.find((u) => u._id.toString() === p.author.toString());
      const commentsCount = memComments.filter((c) => c.post.toString() === p._id.toString()).length;
      return {
        ...p,
        author: sanitizeUser(author),
        likesCount: p.likes.length,
        commentsCount,
        isLiked: curId ? p.likes.some((id) => id.toString() === curId) : false,
      };
    });

    return {
      posts: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    };
  },

  async getUserPosts({ userId, currentUserId = null, page = 1, limit = 10 }) {
    const uId = userId.toString();
    const curId = currentUserId ? currentUserId.toString() : null;
    const skip = (page - 1) * limit;

    if (this.isMongooseActive()) {
      const posts = await Post.find({ author: uId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', '_id username avatar bio');

      const total = await Post.countDocuments({ author: uId });

      const postsWithCounts = await Promise.all(
        posts.map(async (p) => {
          const count = await Comment.countDocuments({ post: p._id });
          const obj = p.toJSON ? p.toJSON() : { ...p };
          obj.commentsCount = count;
          obj.isLiked = curId ? p.likes.some((id) => id.toString() === curId) : false;
          return obj;
        })
      );

      return {
        posts: postsWithCounts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasMore: page * limit < total,
        },
      };
    }

    const matchingPosts = memPosts.filter((p) => p.author.toString() === uId);
    matchingPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = matchingPosts.length;
    const paginated = matchingPosts.slice(skip, skip + limit).map((p) => {
      const author = memUsers.find((u) => u._id.toString() === p.author.toString());
      const commentsCount = memComments.filter((c) => c.post.toString() === p._id.toString()).length;
      return {
        ...p,
        author: sanitizeUser(author),
        likesCount: p.likes.length,
        commentsCount,
        isLiked: curId ? p.likes.some((id) => id.toString() === curId) : false,
      };
    });

    return {
      posts: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    };
  },

  // COMMENT OPERATIONS
  async createComment({ postId, authorId, text }) {
    const pId = postId.toString();
    const aId = authorId.toString();

    if (this.isMongooseActive()) {
      const post = await Post.findById(pId);
      if (!post) {
        const err = new Error('Post not found');
        err.statusCode = 404;
        throw err;
      }
      const comment = await Comment.create({
        post: pId,
        author: aId,
        text,
      });
      return Comment.findById(comment._id).populate('author', '_id username avatar bio');
    }

    const post = memPosts.find((p) => p._id.toString() === pId);
    if (!post) {
      const err = new Error('Post not found');
      err.statusCode = 404;
      throw err;
    }

    const newComment = {
      _id: generateId(),
      post: pId,
      author: aId,
      text,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memComments.push(newComment);

    const author = memUsers.find((u) => u._id.toString() === aId);
    return {
      ...newComment,
      author: sanitizeUser(author),
    };
  },

  async getPostComments(postId) {
    const pId = postId.toString();
    if (this.isMongooseActive()) {
      return Comment.find({ post: pId })
        .sort({ createdAt: 1 })
        .populate('author', '_id username avatar bio');
    }

    return memComments
      .filter((c) => c.post.toString() === pId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((c) => {
        const author = memUsers.find((u) => u._id.toString() === c.author.toString());
        return {
          ...c,
          author: sanitizeUser(author),
        };
      });
  },

  async deleteComment(commentId, userId) {
    const cId = commentId.toString();
    const uId = userId.toString();

    if (this.isMongooseActive()) {
      const comment = await Comment.findById(cId);
      if (!comment) {
        const err = new Error('Comment not found');
        err.statusCode = 404;
        throw err;
      }
      if (comment.author.toString() !== uId) {
        const err = new Error('Unauthorized to delete this comment');
        err.statusCode = 403;
        throw err;
      }
      await Comment.findByIdAndDelete(cId);
      return true;
    }

    const index = memComments.findIndex((c) => c._id.toString() === cId);
    if (index === -1) {
      const err = new Error('Comment not found');
      err.statusCode = 404;
      throw err;
    }
    const comment = memComments[index];
    if (comment.author.toString() !== uId) {
      const err = new Error('Unauthorized to delete this comment');
      err.statusCode = 403;
      throw err;
    }

    memComments.splice(index, 1);
    return true;
  },

  // Reset or seed store
  resetMemoryStore() {
    memUsers.length = 0;
    memPosts.length = 0;
    memComments.length = 0;
  },

  getStats() {
    return {
      mode: this.isMongooseActive() ? 'MongoDB (Mongoose)' : 'In-Memory Store',
      usersCount: memUsers.length,
      postsCount: memPosts.length,
      commentsCount: memComments.length,
    };
  },
};

module.exports = Store;
