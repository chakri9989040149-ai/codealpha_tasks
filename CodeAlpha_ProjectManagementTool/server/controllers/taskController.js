const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Project = require('../models/Project');
const { emitToProject, emitToUser } = require('../sockets/socketHandler');

// @desc    Get all tasks for a project
// @route   GET /api/tasks?projectId=...
// @access  Private (Project Member)
const getTasks = async (req, res, next) => {
  try {
    const { projectId, status, priority, assignee, q } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required',
      });
    }

    const query = { project: projectId };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignee) {
      query.assignee = assignee === 'unassigned' ? null : assignee;
    }
    if (q) {
      query.$or = [
        { title: { $regex: q.trim(), $options: 'i' } },
        { description: { $regex: q.trim(), $options: 'i' } },
      ];
    }

    const tasks = await Task.find(query)
      .populate('assignee', 'name email avatarColor')
      .populate('createdBy', 'name email avatarColor')
      .sort({ order: 1, createdAt: 1 });

    // Attach comments count
    const taskIds = tasks.map((t) => t._id);
    const commentCounts = await Comment.aggregate([
      { $match: { task: { $in: taskIds } } },
      { $group: { _id: '$task', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    commentCounts.forEach((c) => {
      countMap[c._id.toString()] = c.count;
    });

    const enrichedTasks = tasks.map((t) => {
      const obj = t.toObject();
      obj.commentCount = countMap[t._id.toString()] || 0;
      return obj;
    });

    res.status(200).json({
      success: true,
      count: enrichedTasks.length,
      tasks: enrichedTasks,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private (Project Member)
const createTask = async (req, res, next) => {
  try {
    const {
      projectId,
      title,
      description,
      status = 'todo',
      priority = 'medium',
      dueDate,
      assignee,
      labels,
    } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({
        success: false,
        message: 'Project ID and title are required',
      });
    }

    // Determine current order for this column
    const highestTask = await Task.findOne({
      project: projectId,
      status,
    }).sort({ order: -1 });

    const order = highestTask ? highestTask.order + 1 : 0;

    const task = await Task.create({
      project: projectId,
      title: title.trim(),
      description: description ? description.trim() : '',
      status,
      priority,
      dueDate: dueDate || null,
      assignee: assignee || null,
      labels: Array.isArray(labels) ? labels : [],
      order,
      createdBy: req.user._id,
    });

    const populated = await Task.findById(task._id)
      .populate('assignee', 'name email avatarColor')
      .populate('createdBy', 'name email avatarColor');

    const taskObj = populated.toObject();
    taskObj.commentCount = 0;

    // Notify assignee if not creator
    if (assignee && assignee.toString() !== req.user._id.toString()) {
      const notif = await Notification.create({
        user: assignee,
        sender: req.user._id,
        project: projectId,
        task: task._id,
        type: 'assignment',
        message: `${req.user.name} assigned you to task: "${task.title}"`,
        link: `?project=${projectId}&task=${task._id}`,
      });

      const popNotif = await Notification.findById(notif._id).populate(
        'sender',
        'name avatarColor'
      );
      emitToUser(assignee, 'notification:new', popNotif);
    }

    // Broadcast to project room
    emitToProject(projectId.toString(), 'project:task_created', taskObj);

    res.status(201).json({
      success: true,
      task: taskObj,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private (Project Member)
const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const previousAssignee = task.assignee ? task.assignee.toString() : null;

    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assignee,
      labels,
      order,
    } = req.body;

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate || null;
    if (assignee !== undefined) task.assignee = assignee || null;
    if (labels !== undefined) task.labels = Array.isArray(labels) ? labels : [];
    if (order !== undefined) task.order = order;

    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignee', 'name email avatarColor')
      .populate('createdBy', 'name email avatarColor');

    const commentCount = await Comment.countDocuments({ task: task._id });
    const taskObj = populated.toObject();
    taskObj.commentCount = commentCount;

    // Check if newly assigned to a different user
    const newAssignee = task.assignee ? task.assignee.toString() : null;
    if (newAssignee && newAssignee !== previousAssignee && newAssignee !== req.user._id.toString()) {
      const notif = await Notification.create({
        user: newAssignee,
        sender: req.user._id,
        project: task.project,
        task: task._id,
        type: 'assignment',
        message: `${req.user.name} assigned you to task: "${task.title}"`,
        link: `?project=${task.project}&task=${task._id}`,
      });

      const popNotif = await Notification.findById(notif._id).populate(
        'sender',
        'name avatarColor'
      );
      emitToUser(newAssignee, 'notification:new', popNotif);
    }

    // Broadcast to project room
    emitToProject(task.project.toString(), 'project:task_updated', taskObj);

    res.status(200).json({
      success: true,
      task: taskObj,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Move task between columns or reorder (Drag & Drop)
// @route   PUT /api/tasks/:id/move
// @access  Private (Project Member)
const moveTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, order = 0 } = req.body;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const previousStatus = task.status;
    const isStatusChanged = previousStatus !== status;

    task.status = status;
    task.order = Number(order);
    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignee', 'name email avatarColor')
      .populate('createdBy', 'name email avatarColor');

    const commentCount = await Comment.countDocuments({ task: task._id });
    const taskObj = populated.toObject();
    taskObj.commentCount = commentCount;

    // Real-time broadcast to all other clients watching this project
    emitToProject(task.project.toString(), 'project:task_moved', {
      taskId: task._id.toString(),
      task: taskObj,
      previousStatus,
      newStatus: status,
      order: task.order,
      movedBy: {
        id: req.user._id,
        name: req.user.name,
      },
    });

    // Notify assignee if someone else moved their task
    if (
      isStatusChanged &&
      task.assignee &&
      task.assignee.toString() !== req.user._id.toString()
    ) {
      const project = await Project.findById(task.project);
      const colObj = project?.columns?.find((c) => c.id === status);
      const colName = colObj ? colObj.name : status;

      const notif = await Notification.create({
        user: task.assignee,
        sender: req.user._id,
        project: task.project,
        task: task._id,
        type: 'move',
        message: `${req.user.name} moved your task "${task.title}" to ${colName}`,
        link: `?project=${task.project}&task=${task._id}`,
      });

      const popNotif = await Notification.findById(notif._id).populate(
        'sender',
        'name avatarColor'
      );
      emitToUser(task.assignee, 'notification:new', popNotif);
    }

    res.status(200).json({
      success: true,
      task: taskObj,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private (Project Member)
const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const projectId = task.project;

    await Comment.deleteMany({ task: id });
    await Notification.deleteMany({ task: id });
    await Task.findByIdAndDelete(id);

    emitToProject(projectId.toString(), 'project:task_deleted', {
      taskId: id,
    });

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      taskId: id,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTasks,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
};
