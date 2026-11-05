const express = require('express');
const router = express.Router();
const {
  getTasks,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
} = require('../controllers/taskController');
const { protect, isProjectMember } = require('../middleware/auth');
const Task = require('../models/Task');
const Project = require('../models/Project');

router.use(protect);

// Helper middleware to verify task project access for /:id routes
const isTaskMember = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
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
        message: 'You are not a member of the project for this task',
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
  .get(isProjectMember, getTasks)
  .post(isProjectMember, createTask);

router.route('/:id')
  .put(isTaskMember, updateTask)
  .delete(isTaskMember, deleteTask);

router.put('/:id/move', isTaskMember, moveTask);

module.exports = router;
