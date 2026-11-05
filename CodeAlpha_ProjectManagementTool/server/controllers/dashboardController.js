const Project = require('../models/Project');
const Task = require('../models/Task');

// @desc    Get dashboard metrics for current user
// @route   GET /api/dashboard
// @access  Private
const getDashboardData = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Find all projects user belongs to
    const projects = await Project.find({
      $or: [{ owner: userId }, { 'members.user': userId }],
    }).sort({ updatedAt: -1 });

    const projectIds = projects.map((p) => p._id);

    // 2. Find tasks assigned to this user across all their projects
    const myTasks = await Task.find({
      project: { $in: projectIds },
      assignee: userId,
    })
      .populate('project', 'name columns')
      .populate('createdBy', 'name email avatarColor')
      .sort({ dueDate: 1, createdAt: -1 });

    // 3. Find due soon and overdue tasks
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    const dueSoonTasks = [];
    const overdueTasks = [];
    let completedCount = 0;
    let inProgressCount = 0;
    let todoCount = 0;

    myTasks.forEach((task) => {
      const isDone = task.status === 'done';
      if (isDone) {
        completedCount++;
      } else if (task.status === 'in_progress') {
        inProgressCount++;
      } else {
        todoCount++;
      }

      if (task.dueDate && !isDone) {
        const due = new Date(task.dueDate);
        if (due < now) {
          overdueTasks.push(task);
        } else if (due <= threeDaysFromNow) {
          dueSoonTasks.push(task);
        }
      }
    });

    // 4. Compute per-project progress
    const projectProgress = await Promise.all(
      projects.map(async (project) => {
        const total = await Task.countDocuments({ project: project._id });
        const done = await Task.countDocuments({
          project: project._id,
          status: 'done',
        });
        const inProgress = await Task.countDocuments({
          project: project._id,
          status: 'in_progress',
        });
        const todo = await Task.countDocuments({
          project: project._id,
          status: 'todo',
        });

        const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
        const isOwner = project.owner.toString() === userId.toString();

        return {
          _id: project._id,
          name: project.name,
          description: project.description,
          role: isOwner ? 'owner' : 'member',
          membersCount: project.members.length,
          totalTasks: total,
          completedTasks: done,
          inProgressTasks: inProgress,
          todoTasks: todo,
          completionPercentage: percentage,
        };
      })
    );

    res.status(200).json({
      success: true,
      stats: {
        totalProjects: projects.length,
        totalAssignedTasks: myTasks.length,
        completedAssignedTasks: completedCount,
        inProgressAssignedTasks: inProgressCount,
        todoAssignedTasks: todoCount,
        dueSoonCount: dueSoonTasks.length,
        overdueCount: overdueTasks.length,
      },
      myTasks,
      dueSoonTasks,
      overdueTasks,
      projectProgress,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardData,
};
