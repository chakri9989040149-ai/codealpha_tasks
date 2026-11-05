const jwt = require('jsonwebtoken');
const User = require('../models/User');

let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'supersecret_jwt_codealpha_boards_key_2026_x!'
      );

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid socket authentication: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`[Socket] User connected: ${socket.user.name} (${userId})`);

    // Automatically join user's private room for direct notifications
    socket.join(`user:${userId}`);

    // Join project room for board real-time collaboration
    socket.on('join_project', (projectId) => {
      if (projectId) {
        socket.join(`project:${projectId}`);
        console.log(`[Socket] User ${socket.user.name} joined project room: project:${projectId}`);
      }
    });

    // Leave project room
    socket.on('leave_project', (projectId) => {
      if (projectId) {
        socket.leave(`project:${projectId}`);
        console.log(`[Socket] User ${socket.user.name} left project room: project:${projectId}`);
      }
    });

    // Handle typing indicators in comments
    socket.on('typing_comment', ({ projectId, taskId, isTyping }) => {
      socket.to(`project:${projectId}`).emit('user_typing_comment', {
        taskId,
        user: { id: userId, name: socket.user.name },
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.user.name}`);
    });
  });
};

const getIO = () => {
  return ioInstance;
};

// Helper to broadcast to a project room (excluding sender if socket passed, or to all in room)
const emitToProject = (projectId, event, data, excludeSocketId = null) => {
  if (!ioInstance) return;
  if (excludeSocketId) {
    ioInstance.to(`project:${projectId}`).except(excludeSocketId).emit(event, data);
  } else {
    ioInstance.to(`project:${projectId}`).emit(event, data);
  }
};

// Helper to broadcast to a specific user
const emitToUser = (userId, event, data) => {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId.toString()}`).emit(event, data);
};

module.exports = {
  initSocket,
  getIO,
  emitToProject,
  emitToUser,
};
