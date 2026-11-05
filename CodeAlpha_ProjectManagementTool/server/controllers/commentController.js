const Comment = require('../models/Comment');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const Project = require('../models/Project');
const User = require('../models/User');
const { emitToProject, emitToUser } = require('../sockets/socketHandler');

// @desc    Get comments for a task
// @route   GET /api/comments?taskId=...
// @access  Private (Project Member)
const getComments = async (req, res, next) => {
  try {
    const { taskId } = req.query;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required',
      });
    }

    const comments = await Comment.find({ task: taskId })
      .populate('author', 'name email avatarColor')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add comment to a task
// @route   POST /api/comments
// @access  Private (Project Member)
const addComment = async (req, res, next) => {
  try {
    const { taskId, text } = req.body;

    if (!taskId || !text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task ID and comment text are required',
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const comment = await Comment.create({
      task: taskId,
      project: task.project,
      author: req.user._id,
      text: text.trim(),
    });

    const populated = await Comment.findById(comment._id).populate(
      'author',
      'name email avatarColor'
    );

    // Track recipients to avoid sending duplicate notifications
    const notifiedUserIds = new Set();
    notifiedUserIds.add(req.user._id.toString()); // don't notify self

    // 1. Check for @mentions in text (e.g., @Alex, @sarah@example.com)
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    let match;
    const project = await Project.findById(task.project).populate('members.user', 'name email');

    while ((match = mentionRegex.exec(text)) !== null) {
      const queryStr = match[1].toLowerCase();
      const mentionedMember = project?.members?.find((m) => {
        if (!m.user) return false;
        const nameMatch = m.user.name.toLowerCase().replace(/\s+/g, '').includes(queryStr);
        const emailMatch = m.user.email.toLowerCase().includes(queryStr);
        return nameMatch || emailMatch;
      });

      if (mentionedMember && !notifiedUserIds.has(mentionedMember.user._id.toString())) {
        const targetId = mentionedMember.user._id.toString();
        notifiedUserIds.add(targetId);

        const notif = await Notification.create({
          user: targetId,
          sender: req.user._id,
          project: task.project,
          task: task._id,
          type: 'mention',
          message: `${req.user.name} mentioned you in a comment on "${task.title}"`,
          link: `?project=${task.project}&task=${task._id}`,
        });

        const popNotif = await Notification.findById(notif._id).populate(
          'sender',
          'name avatarColor'
        );
        emitToUser(targetId, 'notification:new', popNotif);
      }
    }

    // 2. Notify assignee if not already notified
    if (task.assignee && !notifiedUserIds.has(task.assignee.toString())) {
      const assigneeId = task.assignee.toString();
      notifiedUserIds.add(assigneeId);

      const notif = await Notification.create({
        user: assigneeId,
        sender: req.user._id,
        project: task.project,
        task: task._id,
        type: 'comment',
        message: `${req.user.name} commented on your assigned task: "${task.title}"`,
        link: `?project=${task.project}&task=${task._id}`,
      });

      const popNotif = await Notification.findById(notif._id).populate(
        'sender',
        'name avatarColor'
      );
      emitToUser(assigneeId, 'notification:new', popNotif);
    }

    // 3. Notify task creator if different from assignee and not already notified
    if (
      task.createdBy &&
      !notifiedUserIds.has(task.createdBy.toString())
    ) {
      const creatorId = task.createdBy.toString();
      notifiedUserIds.add(creatorId);

      const notif = await Notification.create({
        user: creatorId,
        sender: req.user._id,
        project: task.project,
        task: task._id,
        type: 'comment',
        message: `${req.user.name} commented on task you created: "${task.title}"`,
        link: `?project=${task.project}&task=${task._id}`,
      });

      const popNotif = await Notification.findById(notif._id).populate(
        'sender',
        'name avatarColor'
      );
      emitToUser(creatorId, 'notification:new', popNotif);
    }

    // Emit comment added to project room
    emitToProject(task.project.toString(), 'project:comment_added', {
      taskId: task._id.toString(),
      comment: populated,
    });

    res.status(201).json({
      success: true,
      comment: populated,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private (Author or Owner)
const deleteComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const comment = await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Check if user is author or project owner
    const project = await Project.findById(comment.project);
    const isOwner = project && project.owner.toString() === req.user._id.toString();
    const isAuthor = comment.author.toString() === req.user._id.toString();

    if (!isAuthor && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this comment',
      });
    }

    const taskId = comment.task;
    const projectId = comment.project;

    await Comment.findByIdAndDelete(id);

    emitToProject(projectId.toString(), 'project:comment_deleted', {
      taskId: taskId.toString(),
      commentId: id,
    });

    res.status(200).json({
      success: true,
      message: 'Comment deleted',
      commentId: id,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getComments,
  addComment,
  deleteComment,
};
