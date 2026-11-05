const express = require('express');
const router = express.Router();
const {
  getComments,
  addComment,
  deleteComment,
} = require('../controllers/commentController');
const { protect } = require('../middleware/auth');
const Task = require('../models/Task');
const Project = require('../models/Project');

router.use(protect);

// Middleware to check membership for the task's project
const verifyTaskAccess = async (req, res, next) => {
  try {
    const taskId = req.query.taskId || req.body.taskId;
    if (!taskId) {
      return res.status(400).json({ success: false, message: 'taskId is required' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const userIdStr = req.user._id.toString();
    const isOwner = project.owner.toString() === userIdStr;
    const isMember = project.members.some(
      (m) => m.user && (m.user._id ? m.user._id.toString() : m.user.toString()) === userIdStr
    );

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this task comments',
      });
    }

    req.task = task;
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

router.route('/')
  .get(verifyTaskAccess, getComments)
  .post(verifyTaskAccess, addComment);

router.delete('/:id', deleteComment);

module.exports = router;
