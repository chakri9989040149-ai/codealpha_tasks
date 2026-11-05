const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToProject, emitToUser } = require('../sockets/socketHandler');

// @desc    Get all projects for current user
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const projects = await Project.find({
      $or: [{ owner: userId }, { 'members.user': userId }],
    })
      .populate('owner', 'name email avatarColor')
      .populate('members.user', 'name email avatarColor')
      .sort({ updatedAt: -1 });

    // Attach task count per project
    const projectIds = projects.map((p) => p._id);
    const taskCounts = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: '$project', total: { $sum: 1 } } },
    ]);

    const countMap = {};
    taskCounts.forEach((tc) => {
      countMap[tc._id.toString()] = tc.total;
    });

    const enriched = projects.map((p) => {
      const pObj = p.toObject();
      pObj.taskCount = countMap[p._id.toString()] || 0;
      const isOwner = p.owner._id.toString() === userId.toString();
      const memberItem = p.members.find(
        (m) => m.user && m.user._id.toString() === userId.toString()
      );
      pObj.userRole = isOwner ? 'owner' : (memberItem ? memberItem.role : 'member');
      return pObj;
    });

    res.status(200).json({
      success: true,
      count: enriched.length,
      projects: enriched,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single project details
// @route   GET /api/projects/:id
// @access  Private (Member or Owner)
const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email avatarColor')
      .populate('members.user', 'name email avatarColor');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const isOwner = project.owner._id.toString() === req.user._id.toString();
    const memberItem = project.members.find(
      (m) => m.user && m.user._id.toString() === req.user._id.toString()
    );

    const projectObj = project.toObject();
    projectObj.userRole = isOwner ? 'owner' : (memberItem ? memberItem.role : 'member');

    res.status(200).json({
      success: true,
      project: projectObj,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new project
// @route   POST /api/projects
// @access  Private
const createProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Project name is required',
      });
    }

    const project = await Project.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      owner: req.user._id,
      members: [
        {
          user: req.user._id,
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
      columns: [
        { id: 'todo', name: 'To Do', order: 0 },
        { id: 'in_progress', name: 'In Progress', order: 1 },
        { id: 'done', name: 'Done', order: 2 },
      ],
    });

    const populated = await Project.findById(project._id)
      .populate('owner', 'name email avatarColor')
      .populate('members.user', 'name email avatarColor');

    const projectObj = populated.toObject();
    projectObj.userRole = 'owner';

    res.status(201).json({
      success: true,
      project: projectObj,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update project info
// @route   PUT /api/projects/:id
// @access  Private (Member or Owner)
const updateProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const project = req.project;

    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();

    await project.save();

    const populated = await Project.findById(project._id)
      .populate('owner', 'name email avatarColor')
      .populate('members.user', 'name email avatarColor');

    emitToProject(project._id.toString(), 'project:updated', populated);

    res.status(200).json({
      success: true,
      project: populated,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private (Owner only)
const deleteProject = async (req, res, next) => {
  try {
    const projectId = req.project._id;

    // Delete tasks, comments, notifications associated with this project
    await Task.deleteMany({ project: projectId });
    await Comment.deleteMany({ project: projectId });
    await Notification.deleteMany({ project: projectId });
    await Project.findByIdAndDelete(projectId);

    emitToProject(projectId.toString(), 'project:deleted', { projectId });

    res.status(200).json({
      success: true,
      message: 'Project and all associated data deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Invite/Add member to project by email
// @route   POST /api/projects/:id/members
// @access  Private (Owner only)
const inviteMember = async (req, res, next) => {
  try {
    const { email, role = 'member' } = req.body;
    const project = req.project;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide user email to invite',
      });
    }

    const targetUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: `No user found with email "${email}". Make sure they have registered an account first!`,
      });
    }

    const alreadyMember = project.members.some(
      (m) => m.user && (m.user._id ? m.user._id.toString() : m.user.toString()) === targetUser._id.toString()
    );

    if (alreadyMember) {
      return res.status(400).json({
        success: false,
        message: `${targetUser.name} (${email}) is already a member of this project`,
      });
    }

    project.members.push({
      user: targetUser._id,
      role: role === 'owner' ? 'owner' : 'member',
      joinedAt: new Date(),
    });

    await project.save();

    // Create notification for targetUser
    const notif = await Notification.create({
      user: targetUser._id,
      sender: req.user._id,
      project: project._id,
      type: 'member_added',
      message: `${req.user.name} added you to project "${project.name}" as ${role}.`,
      link: `?project=${project._id}`,
    });

    const populatedNotif = await Notification.findById(notif._id).populate(
      'sender',
      'name avatarColor'
    );

    emitToUser(targetUser._id, 'notification:new', populatedNotif);

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'name email avatarColor')
      .populate('members.user', 'name email avatarColor');

    emitToProject(project._id.toString(), 'project:members_updated', populatedProject.members);

    res.status(200).json({
      success: true,
      message: `${targetUser.name} added to project`,
      members: populatedProject.members,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove member from project
// @route   DELETE /api/projects/:id/members/:userId
// @access  Private (Owner only)
const removeMember = async (req, res, next) => {
  try {
    const project = req.project;
    const { userId } = req.params;

    if (project.owner.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the project owner',
      });
    }

    project.members = project.members.filter(
      (m) => m.user && (m.user._id ? m.user._id.toString() : m.user.toString()) !== userId
    );

    await project.save();

    // Unassign tasks from this member in this project
    await Task.updateMany(
      { project: project._id, assignee: userId },
      { $set: { assignee: null } }
    );

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'name email avatarColor')
      .populate('members.user', 'name email avatarColor');

    emitToProject(project._id.toString(), 'project:members_updated', populatedProject.members);

    res.status(200).json({
      success: true,
      message: 'Member removed from project',
      members: populatedProject.members,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add column to board
// @route   POST /api/projects/:id/columns
// @access  Private (Member or Owner)
const addColumn = async (req, res, next) => {
  try {
    const { name } = req.body;
    const project = req.project;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Column name is required',
      });
    }

    const columnId = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
    const newOrder = project.columns.length;

    project.columns.push({
      id: columnId,
      name: name.trim(),
      order: newOrder,
    });

    await project.save();

    emitToProject(project._id.toString(), 'project:columns_updated', project.columns);

    res.status(201).json({
      success: true,
      columns: project.columns,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update column name
// @route   PUT /api/projects/:id/columns/:columnId
// @access  Private (Member or Owner)
const updateColumn = async (req, res, next) => {
  try {
    const { name } = req.body;
    const { columnId } = req.params;
    const project = req.project;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Column name cannot be empty',
      });
    }

    const col = project.columns.find((c) => c.id === columnId);
    if (!col) {
      return res.status(404).json({ success: false, message: 'Column not found' });
    }

    col.name = name.trim();
    await project.save();

    emitToProject(project._id.toString(), 'project:columns_updated', project.columns);

    res.status(200).json({
      success: true,
      columns: project.columns,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete column
// @route   DELETE /api/projects/:id/columns/:columnId
// @access  Private (Owner or Member)
const deleteColumn = async (req, res, next) => {
  try {
    const { columnId } = req.params;
    const project = req.project;

    if (project.columns.length <= 1) {
      return res.status(400).json({
        success: false,
        message: 'A board must have at least one column',
      });
    }

    // Filter out column
    project.columns = project.columns.filter((c) => c.id !== columnId);

    // Reindex orders
    project.columns.forEach((col, idx) => {
      col.order = idx;
    });

    await project.save();

    // Move any existing tasks from deleted column to the first column
    const fallbackStatus = project.columns[0].id;
    await Task.updateMany(
      { project: project._id, status: columnId },
      { $set: { status: fallbackStatus } }
    );

    emitToProject(project._id.toString(), 'project:columns_updated', project.columns);
    // Also notify tasks reloaded
    const updatedTasks = await Task.find({ project: project._id })
      .populate('assignee', 'name email avatarColor')
      .populate('createdBy', 'name email avatarColor');
    emitToProject(project._id.toString(), 'project:tasks_reloaded', updatedTasks);

    res.status(200).json({
      success: true,
      message: 'Column removed',
      columns: project.columns,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  inviteMember,
  removeMember,
  addColumn,
  updateColumn,
  deleteColumn,
};
